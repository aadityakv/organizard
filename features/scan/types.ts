// The scan result as the sheet renders it: icon, copy and the one action it offers.
export type ResultView = {
  icon: string;
  iconWash: string;
  iconColor: string;
  title: string;
  body: string;
  actionLabel: string;
  actionIcon: string;
  actionVariant: 'primary' | 'secondary';
  onAction: () => void;
  /** An optional second, quieter action (e.g. Unpack next to Open box). */
  secondary?: { label: string; icon: string; onPress: () => void };
};
