import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

async function moveWithItem(h: Awaited<ReturnType<typeof makeHarness>>, session: string) {
  const snap = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(session))).json()) as {
    move: { id: string };
    statuses: { id: string }[];
  };
  const moveId = snap.move.id;
  await h.json(
    `/v1/moves/${moveId}/mutations`,
    {
      mutations: [
        m('addRoom', { id: 'r0', name: 'Kitchen', icon: 'box' }, 'c0'),
        m(
          'addBox',
          {
            id: 'box1',
            roomId: 'r0',
            number: 1,
            name: 'Pots',
            color: 'amber',
            statusId: snap.statuses[0].id,
          },
          'c1',
        ),
        m('addItem', { id: 'item1', boxId: 'box1', name: 'Skillet', qty: 1, valueCents: 8000 }, 'c2'),
      ],
    },
    auth(session),
  );
  return moveId;
}

describe('photos', () => {
  it('links a photo to an item, uploads + serves the bytes, and surfaces photoIds', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);

    const created = (await (
      await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
    ).json()) as {
      photoId: string;
      uploadPath: string;
    };
    expect(created.photoId).toBeTruthy();

    const snapshotItems = async () =>
      (
        (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as {
          items: { id: string; photoIds: string[] }[];
        }
      ).items;
    // Reserved but not uploaded: clients must not see it yet (it would render as a broken image).
    expect((await snapshotItems()).find((it) => it.id === 'item1')?.photoIds).toEqual([]);

    const put = await h.request(created.uploadPath, {
      method: 'PUT',
      body: 'JPEGDATA',
      headers: { 'content-type': 'image/jpeg', ...auth(session).headers },
    });
    expect(put.status).toBe(200);
    expect((await snapshotItems()).find((it) => it.id === 'item1')?.photoIds).toEqual([created.photoId]);

    const get = await h.request(`/v1/photos/${created.photoId}`, auth(session));
    expect(get.status).toBe(200);
    expect(await get.text()).toBe('JPEGDATA');
  });

  it('rejects photo creation by a viewer and download by a non-member', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);

    const viewer = await h.login('viewer', 'v@x.com');
    await h.seedMember(moveId, viewer.user.id, 'viewer');
    const vCreate = await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(viewer.session));
    expect(vCreate.status).toBe(403);

    const created = (await (
      await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
    ).json()) as { photoId: string };
    const stranger = await h.login('stranger', 's@x.com');
    expect((await h.request(`/v1/photos/${created.photoId}`, auth(stranger.session))).status).toBe(404);
  });

  it('refuses an upload larger than the photo cap', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);
    const created = (await (
      await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
    ).json()) as { uploadPath: string };
    const res = await h.request(created.uploadPath, {
      method: 'PUT',
      body: 'x',
      headers: {
        'content-type': 'image/jpeg',
        'content-length': String(20 * 1024 * 1024),
        ...auth(session).headers,
      },
    });
    expect(res.status).toBe(413);
  });

  it('requires a photo to link to an item or a box (no forever-orphans)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);
    const res = await h.json(`/v1/moves/${moveId}/photos`, {}, auth(session));
    expect(res.status).toBe(400);
  });

  it('updateItem.photoIds relinks photos (adds, removes, ignores cross-move ids)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);

    // Two uploaded photos on the item.
    const mk = async () => {
      const created = (await (
        await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
      ).json()) as { photoId: string };
      const put = await h.request(`/v1/photos/${created.photoId}`, {
        method: 'PUT',
        body: 'J',
        headers: { 'content-type': 'image/jpeg', ...auth(session).headers },
      });
      expect(put.status).toBe(200);
      return created;
    };
    const p1 = await mk();
    const p2 = await mk();

    const before = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as {
      items: { id: string; photoIds: string[] }[];
    };
    expect(before.items.find((it) => it.id === 'item1')?.photoIds).toEqual([p1.photoId, p2.photoId]);

    // Keep only p2: p1 must be unlinked, p2 stays, the foreign id is dropped.
    const res = await h.json(
      `/v1/moves/${moveId}/mutations`,
      {
        mutations: [
          m('updateItem', { id: 'item1', boxId: 'box1', photoIds: [p2.photoId, 'ph_foreign'] }, 'c9'),
        ],
      },
      auth(session),
    );
    expect(res.status).toBe(200);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as {
      items: { id: string; photoIds: string[] }[];
    };
    expect(snap.items.find((it) => it.id === 'item1')?.photoIds).toEqual([p2.photoId]);
  });

  // The privacy policy promises deleting a move removes its photos — the DB rows
  // AND the R2 blobs. The route check alone can't catch a forgotten blob delete
  // (rows are gone, so everything 404s), so we probe the bucket directly.
  it('deleting the move removes the R2 blobs too', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);
    const created = (await (
      await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
    ).json()) as { photoId: string };
    const put = await h.request(`/v1/photos/${created.photoId}`, {
      method: 'PUT',
      body: 'JPEGDATA',
      headers: { 'content-type': 'image/jpeg', ...auth(session).headers },
    });
    expect(put.status).toBe(200);
    const r2Key = `moves/${moveId}/${created.photoId}.jpg`;
    expect(await h.env.PHOTOS.get(r2Key)).not.toBeNull();

    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(session) });
    expect(del.status).toBe(200);
    expect(await h.env.PHOTOS.get(r2Key)).toBeNull();
  });

  it("deleting the account removes the owned moves' R2 blobs too", async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const moveId = await moveWithItem(h, session);
    const created = (await (
      await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'item1' }, auth(session))
    ).json()) as { photoId: string };
    await h.request(`/v1/photos/${created.photoId}`, {
      method: 'PUT',
      body: 'JPEGDATA',
      headers: { 'content-type': 'image/jpeg', ...auth(session).headers },
    });
    const r2Key = `moves/${moveId}/${created.photoId}.jpg`;

    const del = await h.request('/v1/auth/account', { method: 'DELETE', ...auth(session) });
    expect(del.status).toBe(200);
    expect(await h.env.PHOTOS.get(r2Key)).toBeNull();
  });
});
