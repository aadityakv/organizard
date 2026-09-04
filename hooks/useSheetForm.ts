// Form state for bottom sheets that re-initialises on every open.
import { useState } from 'react';

/**
 * Form state for a bottom sheet.
 *
 * The form is (re)initialised from `init` each time `open` flips to true, kept
 * while the sheet is open, and left untouched while it closes so the exit
 * animation still shows the last values. This uses React's "adjust state during
 * render" pattern instead of an effect: no extra render with stale fields, and
 * no setState-in-effect.
 */
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
