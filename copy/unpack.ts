// User-facing copy for unpacking. Keys stay stable; only the strings change.
export const copy = {
  backToBoxButton: 'Back to box',
  cardDone: 'Unpacked',
  cardNotStarted: 'Tick items off as they come out',
  cardProgress: (done: number, total: number) => `${done} of ${total} items unpacked`,
  cardTitle: 'Unpack',
  doneBody: "Everything in this box is out. Change the box status if that's wrong.",
  doneTitle: 'Box unpacked',
  emptyBody: "No items were listed in this box. Mark it unpacked once it's empty.",
  emptyTitle: 'Nothing listed',
  markBoxButton: 'Mark box unpacked',
  progressLabel: (done: number, total: number) => `${done} of ${total} unpacked`,
  qty: (n: number) => `Qty ${n}`,
  screenTitleSuffix: 'Unpacking',
  viewerNote: 'Viewers can follow along. Ask the owner to invite you as an editor to tick items off.',
} as const;
