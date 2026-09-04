// Markers (optional): the chips the item can be tagged with.
import { Text, View } from 'react-native';

import { MarkerChip } from '@/components';
import type { Marker } from '@/data/types';

import { sharedStyles } from './styles';
import { copy } from '@/copy/addItem';

/** Toggleable marker chips for the item. */
export function MarkerSection({
  choices,
  selected,
  onToggle,
}: {
  choices: Marker[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <View style={sharedStyles.chipSection}>
      <Text style={sharedStyles.sectionHeading}>{copy.markersLabel}</Text>
      <View style={sharedStyles.chipWrap}>
        {choices.map((m) => (
          <MarkerChip
            key={m.id}
            label={m.label}
            color={m.color}
            icon={m.icon}
            selected={selected.includes(m.id)}
            onPress={() => onToggle(m.id)}
          />
        ))}
      </View>
    </View>
  );
}
