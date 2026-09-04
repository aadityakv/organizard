// Add item — form-first, photo optional.
// Modal route. params: { boxId, itemId?, photo? }. The highest-frequency flow in the app.
// Leads with the item form; a photo can be captured inline but is never required.
// The pieces live in features/add-item; this file is the layout.
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Icon } from '@/components';
import {
  ItemFields,
  KeyboardDoneBar,
  MarkerSection,
  MoveToBoxPicker,
  PhotoSection,
  SaveFooter,
  useItemForm,
} from '@/features/add-item';
import { boxColor, colors, fonts, fontSize, gutter, palette, radius, space } from '@/theme';
import { copy } from '@/copy/addItem';

/** Add / edit item modal. Params: boxId, optional itemId (edit) and photo (prefilled capture). */
export default function AddItem() {
  const params = useLocalSearchParams<{ boxId: string; itemId?: string; photo?: string }>();
  const form = useItemForm(params);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable
            onPress={form.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
          >
            <Icon name="x" size={22} color={colors.textBody} />
          </Pressable>

          <View style={styles.boxTag}>
            <View style={[styles.boxTagDot, { backgroundColor: boxColor(form.hueName) }]} />
            <Text numberOfLines={1} style={styles.boxTagLabel}>
              {form.boxLabel}
            </Text>
          </View>

          {/* spacer to keep the label visually centered against the close button */}
          <View style={styles.topBtnSpacer} />
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <ItemFields
            isEdit={form.isEdit}
            name={form.name}
            value={form.value}
            qty={form.qty}
            note={form.note}
            parsedValue={form.parsedValue}
            onName={form.setName}
            onValue={form.setValue}
            onQty={form.setQty}
            onNote={form.setNote}
          />

          <PhotoSection
            photos={form.photos}
            session={form.session}
            onAddPhoto={form.addPhoto}
            onRemovePhoto={form.removePhoto}
          />

          <MarkerSection
            choices={form.markerChoices}
            selected={form.selectedMarkers}
            onToggle={form.toggleMarker}
          />

          {form.isEdit && form.canEdit ? (
            <>
              <MoveToBoxPicker
                boxes={form.boxes}
                targetBoxId={form.targetBoxId}
                onSelect={form.setTargetBoxId}
              />

              <Pressable
                onPress={form.confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete item"
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
              >
                <Icon name="trash-2" size={18} color={colors.danger} />
                <Text style={styles.deleteText}>{copy.deleteItem}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>

        <SaveFooter
          canEdit={form.canEdit}
          isEdit={form.isEdit}
          addedCount={form.addedCount}
          onSave={form.save}
          onSaveEdit={form.saveEdit}
        />
      </KeyboardAvoidingView>

      <KeyboardDoneBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },
  flex: {
    flex: 1,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingVertical: space[2],
    gap: space[2],
    backgroundColor: colors.surfaceApp,
    borderBottomWidth: 1,
    borderBottomColor: palette.sand300,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  topBtnSpacer: {
    width: 38,
    height: 38,
  },
  boxTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  boxTagDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  boxTagLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: colors.textStrong,
    flexShrink: 1,
  },

  form: {
    flex: 1,
  },
  formContent: {
    padding: gutter,
    gap: space[3] + 2,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: space[1],
  },
  deleteBtnPressed: {
    opacity: 0.7,
  },
  deleteText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.danger,
  },
});
