// Constants shared across the add-item feature: the iOS keyboard-accessory id that
// ties fields to KeyboardDoneBar, the layout animation played when a photo lands,
// and the fixed height of the inline camera card.
import { LayoutAnimation, Platform, UIManager, type LayoutAnimationConfig } from 'react-native';

// iOS keyboard "Done" bar — lets you dismiss the keyboard (which otherwise covers
// Save) from fields that have no usable return key (number pad, multiline notes).
export const KBD_ACCESSORY_ID = 'add-item-kbd';

/** The accessory id to hand to inputs: only iOS has InputAccessoryView. */
export const KBD_ACCESSORY = Platform.OS === 'ios' ? KBD_ACCESSORY_ID : undefined;

// A friendly press animation for the captured layout when photos arrive.
export const FLASH_CONFIG: LayoutAnimationConfig = LayoutAnimation.create(
  180,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const CAMERA_CARD_H = 240;
