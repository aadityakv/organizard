// Starter statuses and markers every new shared move begins with (mirrors data/defaults.ts in the app).
export const DEFAULT_STATUSES: { label: string; color: string }[] = [
  { label: 'Packing', color: 'amber' },
  { label: 'Sealed', color: 'green' },
  { label: 'In transit', color: 'sky' },
  { label: 'Unpacked', color: 'slate' },
];

export const DEFAULT_MARKERS: { label: string; color: string; icon: string }[] = [
  { label: 'Fragile', color: 'coral', icon: 'wine' },
  { label: 'Open first', color: 'teal', icon: 'package-open' },
  { label: 'Heavy', color: 'indigo', icon: 'dumbbell' },
  { label: 'Keep dry', color: 'sky', icon: 'umbrella' },
  { label: 'This way up', color: 'amber', icon: 'arrow-up' },
];
