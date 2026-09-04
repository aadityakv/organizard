// Markers sheet — toggle the standard set, or create a new marker.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ColorDot, Icon, Input, MarkerChip, Sheet } from '@/components';
import type { Marker } from '@/data/types';
import { BOX_COLORS, palette, radius } from '@/theme';

import { shared } from './styles';

/** Sheet to toggle the box's handling markers or create a custom one. */
export function MarkersSheet({
  visible,
  allMarkers,
  selected,
  onToggle,
  onCreate,
  onClose,
}: {
  visible: boolean;
  allMarkers: Marker[];
  selected: string[];
  onToggle: (markerId: string) => void;
  onCreate: (label: string, color: string, icon: string) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('coral');

  const close = () => {
    setAdding(false);
    setName('');
    setColor('coral');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Markers">
      <Text style={shared.sheetBlurb}>
        Handling flags for this box — fragile, open first, heavy&hellip; Tap to toggle.
      </Text>
      <View style={styles.markerSheetWrap}>
        {allMarkers.map((m) => (
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

      {adding ? (
        <View style={styles.markerCreate}>
          <Input
            label="New marker"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Do not stack, Sell, Donate"
            autoFocus
          />
          <Text style={shared.fieldLabel}>Color</Text>
          <View style={shared.palette}>
            {BOX_COLORS.map((c) => (
              <ColorDot key={c} color={c} size={30} selected={c === color} onPress={() => setColor(c)} />
            ))}
          </View>
          <View style={shared.sheetActions}>
            <View style={shared.flex1}>
              <Button variant="ghost" size="md" fullWidth onPress={() => setAdding(false)}>
                Cancel
              </Button>
            </View>
            <View style={shared.flex1}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={!name.trim()}
                onPress={() => {
                  onCreate(name.trim(), color, 'tag');
                  setName('');
                  setColor('coral');
                  setAdding(false);
                }}
              >
                Create marker
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new marker"
          onPress={() => setAdding(true)}
          style={({ pressed }) => [shared.dashed, pressed && shared.pressed]}
        >
          <Icon name="plus" size={18} color={palette.green600} />
          <Text style={shared.dashedText}>Create a new marker</Text>
        </Pressable>
      )}

      <View style={shared.doneButton}>
        <Button variant="secondary" size="lg" fullWidth onPress={close}>
          Done
        </Button>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  markerSheetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  markerCreate: {
    backgroundColor: palette.cream100,
    borderRadius: radius.lg,
    padding: 14,
  },
});
