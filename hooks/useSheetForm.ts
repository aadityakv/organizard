// Form state for bottom sheets that re-initialises on every open.
import { useState } from 'react';

/** Form state for a bottom sheet, re-initialised from `init` each time it opens (adjusted during render, not in an effect). */
export function useSheetForm<T extends object>(
  open: boolean,
  init: () => T,
): [form: T, patch: (partial: Partial<T>) => void] {
  const [form, setForm] = useState<T>(init);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(init());
  }
  const patch = (partial: Partial<T>): void => setForm((prev) => ({ ...prev, ...partial }));
  return [form, patch];
}
