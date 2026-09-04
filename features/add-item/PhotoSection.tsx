// Photos (optional, collapsed by default): the strip of captured photos, then
// either the inline camera card or the ghost "Add photo" affordance.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { colors, fonts, fontSize, palette, radius, space } from '@/theme';

import { CameraCard } from './CameraCard';
import { PhotoThumb } from './PhotoThumb';
import { sharedStyles } from './styles';
import { useCapture } from './useCapture';
import { copy } from '@/copy/addItem';

/** Photo strip plus the inline camera or "Add photo" affordance. */
export function PhotoSection({
  photos,
  session,
  onAddPhoto,
  onRemovePhoto,
}: {
  photos: string[];
  session: string | null;
  onAddPhoto: (ref: string) => void;
  onRemovePhoto: (uri: string, index: number) => void;
}) {
  const capture = useCapture(onAddPhoto);
  return (
    <View style={styles.photoSection}>
      <Text style={sharedStyles.sectionHeading}>{copy.photosOptional}</Text>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          keyboardShouldPersistTaps="handled"
        >
          {photos.map((ref, i) => (
            <PhotoThumb
              key={`${ref}-${i}`}
              photoRef={ref}
              session={session}
              isCover={i === 0}
              onRemove={() => onRemovePhoto(ref, i)}
            />
          ))}
        </ScrollView>
      ) : null}

      {capture.cameraOpen ? (
        <CameraCard capture={capture} />
      ) : (
        <Pressable
          onPress={capture.openCamera}
          accessibilityRole="button"
          accessibilityLabel={photos.length === 0 ? 'Add photo' : 'Add another photo'}
          style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]}
        >
          <Icon name={photos.length === 0 ? 'camera' : 'plus'} size={18} color={colors.brand} />
          <Text style={styles.addPhotoText}>
            {photos.length === 0 ? 'Add photo (optional)' : 'Add another photo'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    gap: space[2],
  },
  stripContent: {
    gap: space[2],
    alignItems: 'center',
    paddingRight: space[1],
    paddingTop: 5,
    paddingHorizontal: 5,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.green200,
    backgroundColor: colors.brandWash,
  },
  addPhotoBtnPressed: {
    opacity: 0.8,
    backgroundColor: palette.green100,
  },
  addPhotoText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.brandPressed,
  },
});
