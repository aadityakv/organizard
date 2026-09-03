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

    // the item now carries the photo id in the snapshot
    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as {
      items: { id: string; photoIds: string[] }[];
    };
    expect(snap.items.find((it) => it.id === 'item1')?.photoIds).toEqual([created.photoId]);

    // upload bytes, then read them back
    const put = await h.request(created.uploadPath, {
      method: 'PUT',
      body: 'JPEGDATA',
      headers: { 'content-type': 'image/jpeg', ...auth(session).headers },
    });
    expect(put.status).toBe(200);

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
});
