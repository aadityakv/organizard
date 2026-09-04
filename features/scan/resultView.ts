// Turns a classified scan into what the result sheet shows and does.
import { router } from 'expo-router';

import { copy } from '@/copy/scan';
import { money } from '@/lib/money';
import type { ScanResult } from '@/lib/qr/codes';
import { routes } from '@/lib/routes';
import { boxById, boxStats, roomById, statusById, type Store } from '@/store/useStore';
import { boxColor, boxTint, colors, DEFAULT_HUE, palette } from '@/theme';

import type { ResultView } from './types';

/** The sheet content for one scan result; reads the store once (a result is a snapshot). */
export function buildResultView(
  result: ScanResult,
  store: Store,
  rescan: () => void,
  jumpToMove: (moveId: string, boxId: string) => void,
): ResultView {
  if (result.kind === 'thisMove') {
    const box = boxById(store, result.boxId);
    const room = box ? roomById(store, box.roomId) : undefined;
    const status = box ? statusById(store, box.status) : undefined;
    const stats = box ? boxStats(store, box.id) : { count: 0, value: 0 };
    const hue = box?.color ?? DEFAULT_HUE;
    const open = () => router.push(routes.box(result.boxId));
    return {
      icon: 'package-check',
      iconWash: boxTint(hue),
      iconColor: boxColor(hue),
      title: box ? `Box #${box.number} · ${box.name}` : copy.boxFoundTitle,
      body: box
        ? `${room?.name ?? ''} — ${stats.count} items · ${money(stats.value)}${
            status?.label ? ` · ${status.label}` : ''
          }`
        : copy.boxFoundBody,
      actionLabel: copy.openBoxButton,
      actionIcon: 'box',
      actionVariant: 'primary',
      onAction: open,
    };
  }

  if (result.kind === 'otherMove') {
    return {
      icon: 'arrow-right-left',
      iconWash: colors.infoWash,
      iconColor: colors.info,
      title: copy.otherMoveTitle(result.moveName),
      body: copy.otherMoveBody,
      actionLabel: copy.jumpButton,
      actionIcon: 'corner-up-right',
      actionVariant: 'primary',
      onAction: () => jumpToMove(result.moveId, result.boxId),
    };
  }

  if (result.kind === 'noAccess') {
    return {
      icon: 'lock',
      iconWash: palette.cream200,
      iconColor: palette.ink500,
      title: copy.noAccessTitle,
      body: copy.noAccessBody,
      actionLabel: copy.scanAgainButton,
      actionIcon: 'scan-line',
      actionVariant: 'secondary',
      onAction: rescan,
    };
  }

  return {
    icon: 'help-circle',
    iconWash: colors.warningWash,
    iconColor: colors.warning,
    title: copy.unknownTitle,
    body: copy.unknownBody,
    actionLabel: copy.scanAgainButton,
    actionIcon: 'scan-line',
    actionVariant: 'secondary',
    onAction: rescan,
  };
}
