// The local→shared upgrade recipe, as a pure function: replay a move's whole
// inventory as one ordered mutation batch the server can apply (ids preserved).
// Pure so it is unit-testable in node; the orchestration around it (creating the
// server move, holding sync) lives in services/share.ts.
import type { Mutation } from '@/shared';

import { uid } from '@/lib/uid';
import type { SliceData } from '@/store/library';

/** Mutations that recreate a move on the server, ordered so every reference exists before it is used. */
export function buildMigrationBatch(data: SliceData): Mutation[] {
  const out: Mutation[] = [];
  const ts = Date.now();
  const cid = () => uid('mig');

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
      payload: { id: r.id, name: r.name, dest: r.dest ?? null, icon: r.icon },
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
    }
  }
  return out;
}
