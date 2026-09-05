// Replays a move's whole inventory as one ordered mutation batch, so the server can
// recreate a local move when it becomes shared (ids preserved). Not a database
// migration: those live in server/drizzle. Pure so it is unit-tested in node; the
// orchestration (creating the server move, queueing the batch) is services/share.ts.
import { isUnpacked } from '@/data/types';
import type { Mutation } from '@/shared';

import { uid, ID_PREFIX } from '@/lib/uid';
import type { SliceData } from '@/store/library';

/** Mutations that recreate a move on the server, ordered so every reference exists before it is used. */
export function buildShareReplayBatch(data: SliceData): Mutation[] {
  const out: Mutation[] = [];
  const ts = Date.now();
  const cid = () => uid(ID_PREFIX.replay);

  for (const st of data.statuses)
    out.push({
      type: 'addStatus',
      clientId: cid(),
      ts,
      payload: { id: st.id, label: st.label, color: st.color },
    });
  for (const mk of data.markers)
    out.push({
      type: 'addMarker',
      clientId: cid(),
      ts,
      payload: { id: mk.id, label: mk.label, color: mk.color, icon: mk.icon },
    });
  for (const r of data.rooms)
    out.push({
      type: 'addRoom',
      clientId: cid(),
      ts,
      payload: { id: r.id, name: r.name, dest: r.dest ?? null, icon: r.icon, color: r.color },
    });
  for (const b of data.boxes) {
    out.push({
      type: 'addBox',
      clientId: cid(),
      ts,
      payload: {
        id: b.id,
        roomId: b.roomId,
        number: b.number,
        name: b.name,
        color: b.color,
        statusId: b.status,
      },
    });
    for (const markerId of b.markers)
      out.push({ type: 'setBoxMarker', clientId: cid(), ts, payload: { boxId: b.id, markerId, on: true } });
  }
  for (const [boxId, items] of Object.entries(data.itemsByBox)) {
    for (const it of items) {
      out.push({
        type: 'addItem',
        clientId: cid(),
        ts,
        payload: {
          id: it.id,
          boxId,
          name: it.name,
          qty: it.qty,
          valueCents: Math.round((it.value || 0) * 100),
          note: it.note ?? null,
          icon: it.icon ?? null,
          markerIds: it.markers ?? [],
          photoIds: [],
        },
      });
      if (isUnpacked(it))
        out.push({ type: 'setItemUnpacked', clientId: cid(), ts, payload: { id: it.id, boxId, on: true } });
    }
  }
  return out;
}
