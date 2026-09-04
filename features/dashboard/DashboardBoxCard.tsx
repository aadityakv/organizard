// Card factory — resolves a box's status + markers + room for <BoxCard>.
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BoxCard } from '@/components';
import type { Box } from '@/data/types';
import { photoSource } from '@/lib/photos';
import { boxStats, markerById, roomById, statusById, useStore } from '@/store/useStore';

import { openBox } from './openBox';
import { shared } from './styles';
import { NEUTRAL_HUE } from '@/theme';

/** BoxCard wired to the store for the dashboard grid. */
export function DashboardBoxCard({ box }: { box: Box }) {
  const status = useStore((s) => statusById(s, box.status));
  const room = useStore((s) => roomById(s, box.roomId));
  const markerDefs = useStore(
    useShallow((s) =>
      box.markers.map((id) => markerById(s, id)).filter((m): m is NonNullable<typeof m> => Boolean(m)),
    ),
  );
  const { count, value } = useStore(useShallow((s) => boxStats(s, box.id)));
  const session = useStore((s) => s.session);
  const coverSrc = box.cover ? photoSource(box.cover, session) : undefined;

  return (
    <BoxCard
      name={box.name}
      number={box.number}
      color={box.color}
      room={room?.name}
      itemCount={count}
      value={value}
      statusLabel={status?.label ?? '—'}
      statusColor={status?.color ?? NEUTRAL_HUE}
      markers={markerDefs.map((m) => ({ label: m.label, color: m.color, icon: m.icon }))}
      cover={coverSrc?.uri ?? null}
      coverHeaders={coverSrc?.headers}
      onPress={() => openBox(box.id)}
      style={shared.gridCard}
    />
  );
}
