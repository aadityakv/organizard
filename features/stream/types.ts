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
export const MIC = { ready: 'ready', listening: 'listening', gotIt: 'gotit', fail: 'fail' } as const;
export type Mic = (typeof MIC)[keyof typeof MIC];

/** The two views of the one screen, flipped in place. */
export const STREAM_VIEW = { capture: 'capture', stream: 'stream' } as const;
export type StreamView = (typeof STREAM_VIEW)[keyof typeof STREAM_VIEW];

export type BoxRef = Pick<Box, 'id' | 'number' | 'name' | 'color'>;

/** Display label for a box in the session UI ("Box #3 · Kitchen"). */
export const boxLabel = (b?: { number: number; name: string }): string =>
  b ? `Box #${b.number} · ${b.name}` : 'Box';
