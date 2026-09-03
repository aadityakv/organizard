// Shapes shared across the capture / stream screen.
import type { Box } from '@/data/types';

/** An item captured in this session; committed to the store only when the user taps Done. */
export type SItem = {
  id: string;
  name: string;
  qty: number | null;
  value: number | null;
  icon: string;
  needsFix: boolean;
  boxId: string;
  photo?: string | null;
};

/** Mic state machine: idle → listening → (gotit | fail) → idle after a beat. */
export type Mic = 'ready' | 'listening' | 'gotit' | 'fail';

/** The two views of the one screen, flipped in place. */
export type StreamView = 'capture' | 'stream';

export type BoxRef = Pick<Box, 'id' | 'number' | 'name' | 'color'>;

export const boxLabel = (b?: { number: number; name: string }): string =>
  b ? `Box #${b.number} · ${b.name}` : 'Box';
