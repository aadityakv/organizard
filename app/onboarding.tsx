// Onboarding — sign in, then create or join a move. Two light steps, no tutorial.
// On finish: mark onboarded in the store and replace into the tabs.
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, GeckoMark, Icon } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette, radius, shadow, space } from '@/theme';

type Step = 'signin' | 'choose';

// ─────────────────────────────────────────────────────────────
// A large, tactile choice card (create / join a move).
// ─────────────────────────────────────────────────────────────
type ChoiceCardProps = {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ChoiceCard({ icon, iconBg, iconColor, title, subtitle, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
        styles.choiceCard,
        pressed && styles.choiceCardPressed,
      ]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.choiceBody}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={palette.ink400} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep] = useState<Step>('signin');

  // Finish onboarding — mark it in the store, then hand off to the tabs.
  const finish = () => {
    useStore.getState().setOnboarded(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {step === 'signin' ? (
        <View style={styles.signinShell}>
          {/* Lockup — gecko + wordmark + tagline */}
          <View style={styles.hero}>
            <View style={styles.geckoGlow}>
              <GeckoMark size={96} />
            </View>
            <Text style={styles.wordmark}>
              <Text style={styles.wordmarkAccent}>Organi</Text>
              <Text style={styles.wordmarkInk}>zard</Text>
            </Text>
            <Text style={styles.tagline}>Pack fast. Find anything. Share the load.</Text>
          </View>

          {/* Sign-in actions */}
          <View style={styles.signinActions}>
            <Pressable
              onPress={() => setStep('choose')}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              style={({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
                styles.appleButton,
                pressed && styles.appleButtonPressed,
              ]}
            >
              <Icon name="apple" size={19} color={palette.white} />
              <Text style={styles.appleLabel}>Continue with Apple</Text>
            </Pressable>

            <Button variant="secondary" size="lg" fullWidth iconLeft="mail" onPress={() => setStep('choose')}>
              Continue with email
            </Button>

            <Text style={styles.terms}>By continuing you agree to our Terms & Privacy.</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.chooseScroll}
          contentContainerStyle={styles.chooseContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step header */}
          <View style={styles.chooseHeader}>
            <GeckoMark size={48} />
            <Text style={styles.chooseTitle}>Start a move</Text>
            <Text style={styles.chooseSubtitle}>
              Create a fresh move, or join one a friend shared with you.
            </Text>
          </View>

          {/* The two paths */}
          <View style={styles.choices}>
            <ChoiceCard
              icon="plus"
              iconBg={palette.green50}
              iconColor={palette.green600}
              title="Create a move"
              subtitle="Name it, add boxes, invite a buddy"
              onPress={finish}
            />
            <ChoiceCard
              icon="link"
              iconBg={palette.blue50}
              iconColor={palette.blue600}
              title="Join a move"
              subtitle="Paste an invite link or code"
              onPress={finish}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },

  // ── Sign-in step ──────────────────────────────────────────
  signinShell: {
    flex: 1,
    paddingHorizontal: space[6], // 24
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geckoGlow: {
    // green-tinted drop glow under the mark
    shadowColor: colors.brand,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  wordmark: {
    marginTop: 14,
    fontFamily: fonts.display.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  wordmarkAccent: {
    fontFamily: fonts.display.bold,
    color: palette.green600,
  },
  wordmarkInk: {
    fontFamily: fonts.display.bold,
    color: palette.ink900,
  },
  tagline: {
    marginTop: 6,
    maxWidth: 260,
    fontFamily: fonts.body.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: palette.ink500,
    textAlign: 'center',
  },
  signinActions: {
    gap: space[3], // 12
    paddingBottom: space[5], // 20
  },
  appleButton: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: palette.ink900,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2], // 8
    ...shadow.sm,
  },
  appleButtonPressed: {
    backgroundColor: palette.ink700,
    transform: [{ scale: 0.97 }],
  },
  appleLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 16,
    letterSpacing: 0.1,
    color: palette.white,
  },
  terms: {
    marginTop: space[1], // 4
    fontFamily: fonts.body.semibold,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
  },

  // ── Choose step ───────────────────────────────────────────
  chooseScroll: {
    flex: 1,
  },
  chooseContent: {
    flexGrow: 1,
    paddingHorizontal: space[6], // 24
    paddingTop: space[10], // 40
    paddingBottom: space[8], // 32
    justifyContent: 'center',
  },
  chooseHeader: {
    marginBottom: space[8], // 32
  },
  chooseTitle: {
    marginTop: 18,
    marginBottom: 6,
    fontFamily: fonts.display.bold,
    fontSize: 30,
    lineHeight: 34,
    color: palette.ink900,
  },
  chooseSubtitle: {
    fontFamily: fonts.body.semibold,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink500,
  },
  choices: {
    gap: space[3] + 2, // 14
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2, // 14
    padding: 18,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: radius.xl, // 24
    ...shadow.sm,
  },
  choiceCardPressed: {
    backgroundColor: palette.cream100,
    transform: [{ scale: 0.985 }],
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md, // 14
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceBody: {
    flex: 1,
    minWidth: 0,
  },
  choiceTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    lineHeight: 22,
    color: palette.ink900,
  },
  choiceSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: palette.ink500,
  },
});
