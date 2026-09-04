// Status sheet — pick an existing status or create a new one.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ColorDot, Icon, Input, Sheet, StatusChip } from '@/components';
import type { Status } from '@/data/types';
import { BOX_COLORS, fonts, palette, radius } from '@/theme';

import { shared } from './styles';

/** Sheet to pick the box status or create a custom one. */
export function StatusSheet({
  visible,
  statuses,
  currentId,
  onPick,
  onCreate,
  onClose,
}: {
  visible: boolean;
  statuses: Status[];
  currentId: string;
  onPick: (statusId: string) => void;
  onCreate: (label: string, color: string) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('orchid');

  const close = () => {
    setCreating(false);
    setName('');
    setColor('orchid');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={creating ? 'Create a status' : 'Box status'}>
      {!creating ? (
        <View>
          <View style={styles.optionList}>
            {statuses.map((s) => {
              const active = s.id === currentId;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onPick(s.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    active && styles.optionRowActive,
                    pressed && shared.pressed,
                  ]}
                >
                  <StatusChip label={s.label} color={s.color} />
                  {s.custom ? <Text style={styles.customTag}>Custom</Text> : null}
                  {active ? (
                    <View style={styles.optionCheck}>
                      <Icon name="check" size={20} color={palette.green600} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a new status"
            onPress={() => setCreating(true)}
            style={({ pressed }) => [shared.dashed, pressed && shared.pressed]}
          >
            <Icon name="plus" size={18} color={palette.green600} />
            <Text style={shared.dashedText}>New status&hellip;</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Storage unit, Sell, Trash"
            autoFocus
          />
          <Text style={shared.fieldLabel}>Color</Text>
          <View style={shared.palette}>
            {BOX_COLORS.map((c) => (
              <ColorDot key={c} color={c} size={30} selected={c === color} onPress={() => setColor(c)} />
            ))}
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Preview</Text>
            <StatusChip label={name.trim() || 'New status'} color={color} />
          </View>
          <View style={shared.sheetActions}>
            <View style={shared.flex1}>
              <Button variant="ghost" size="md" fullWidth onPress={() => setCreating(false)}>
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
                  onCreate(name.trim(), color);
                  setCreating(false);
                  setName('');
                  setColor('orchid');
                }}
              >
                Add status
              </Button>
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  optionList: { gap: 4, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    minHeight: 44,
  },
  optionRowActive: { backgroundColor: palette.cream100 },
  optionCheck: { marginLeft: 'auto' },
  customTag: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    color: palette.ink400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  previewLabel: { fontFamily: fonts.body.bold, fontSize: 13, color: palette.ink500 },
});
