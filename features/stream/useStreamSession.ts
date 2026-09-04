// The session ledger: items captured so far, which one was captured last (for the
// "Got it" card / undo / re-say), which one is being fixed, and the commit to the
// store when the user taps Done. Nothing here touches the mic or the camera.
import { useMemo, useState } from 'react';

import { useStore } from '@/store/useStore';

import type { SItem } from './types';

/** The session ledger: captured items, last capture/batch, undo and commit to the store. */
export function useStreamSession() {
  const [session, setSession] = useState<SItem[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  // Ids of the last spoken batch (Photos-off), so "Redo last" can retract the whole batch.
  const [lastBatchIds, setLastBatchIds] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const lastIt = session.find((it) => it.id === lastId) ?? null;
  const editIt = session.find((it) => it.id === editId) ?? null;
  const sessionValue = useMemo(
    () => session.reduce((a, it) => a + (it.value || 0) * (it.qty || 1), 0),
    [session],
  );
  const fixCount = session.filter((it) => it.needsFix).length;
  const boxCount = new Set(session.map((it) => it.boxId)).size;

  /** One item captured (snap + say, or a typed fix). */
  const addOne = (it: SItem) => {
    setSession((prev) => [...prev, it]);
    setLastId(it.id);
  };

  /** A whole spoken batch (Photos-off). */
  const addBatch = (batch: SItem[]) => {
    setLastBatchIds(batch.map((b) => b.id));
    setSession((prev) => [...prev, ...batch]);
    setLastId(batch[batch.length - 1].id);
  };

  const patch = (id: string, changes: Partial<SItem> | ((current: SItem) => Partial<SItem>)) =>
    setSession((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, ...(typeof changes === 'function' ? changes(it) : changes) } : it,
      ),
    );

  const remove = (id: string) => {
    setSession((prev) => prev.filter((it) => it.id !== id));
    if (lastId === id) setLastId(null);
  };

  /** Retract the last spoken batch; returns false when there is nothing to retract. */
  const retractLastBatch = (): boolean => {
    const ids = lastBatchIds;
    if (!ids.length) return false;
    setSession((prev) => prev.filter((it) => !ids.includes(it.id)));
    setLastId(null);
    setLastBatchIds([]);
    return true;
  };

  /** Undo the last captured item. */
  const undo = () => {
    setSession((prev) => prev.filter((it) => it.id !== lastId));
    if (lastBatchIds.includes(lastId ?? '')) setLastBatchIds([]); // the batch is no longer retractable as a whole
    setLastId(null);
  };

  /** Write every captured item into the store. */
  const commit = () => {
    const st = useStore.getState();
    for (const it of session) {
      // A collaborator may have deleted the box mid-session; don't mint orphan items.
      if (!st.boxes.some((b) => b.id === it.boxId)) continue;
      st.addItem(it.boxId, {
        name: it.name?.trim() || 'Untitled item',
        qty: it.qty ?? undefined,
        value: it.value ?? undefined,
        icon: it.icon,
        photos: it.photo ? [it.photo] : undefined,
      });
    }
  };

  return {
    session,
    lastId,
    lastIt,
    lastBatchIds,
    editId,
    editIt,
    sessionValue,
    fixCount,
    boxCount,
    setLastId,
    setEditId,
    addOne,
    addBatch,
    patch,
    remove,
    retractLastBatch,
    undo,
    commit,
  };
}
