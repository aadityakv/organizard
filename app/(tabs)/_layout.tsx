// Bottom nav: Boxes · Capture (center, raised verb) · Find. The center button is a
// VERB (free single-item capture → /capture picker), not a tab. Scan folds into Find;
// Share lives in the Boxes header. (Claude Design "Nav Rethink" — Option A.)
import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { Icon } from '@/components/Icon';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette, radius, shadow } from '@/theme';

const TABS: { name: string; icon: string; label: string; center?: boolean }[] = [
  { name: 'index', icon: 'package', label: 'Boxes' },
  { name: 'capture', icon: 'camera', label: 'Capture', center: true },
  { name: 'find', icon: 'search', label: 'Find' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const boxes = useStore((s) => s.boxes);
  // Capture opens the single-item capture view of the unified capture screen, scoped to
  // the most recent box (or the add-a-box prompt when the library is empty).
  const openCapture = () => {
    const b = boxes[boxes.length - 1]?.id;
    router.push(b ? `/stream/${b}?view=capture` : '/capture');
  };
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {TABS.map((tab) => {
        if (tab.center) {
          // Verb: capture is an action screen, not a tab destination.
          return (
            <Pressable
              key={tab.name}
              accessibilityLabel={tab.label}
              onPress={openCapture}
              style={styles.centerWrap}
            >
              <View style={styles.centerBtn}>
                <Icon name={tab.icon} size={26} color="#fff" />
              </View>
              <Text style={styles.centerLabel}>{tab.label}</Text>
            </Pressable>
          );
        }

        const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
        const focused = state.index === routeIndex;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[routeIndex]?.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
        };
        return (
          <Pressable key={tab.name} accessibilityLabel={tab.label} onPress={onPress} style={styles.tab}>
            <Icon name={tab.icon} size={24} color={focused ? palette.green700 : palette.ink400} />
            <Text style={[styles.label, { color: focused ? palette.green700 : palette.ink400 }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tab navigator for an open move: Boxes · Capture · Find, with the custom raised center button. */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="find" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(252,251,248,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.sand300,
  },
  tab: { alignItems: 'center', gap: 3, minWidth: 56 },
  label: { fontFamily: fonts.body.extra, fontSize: 11 },
  centerWrap: { alignItems: 'center', justifyContent: 'flex-end', minWidth: 56, gap: 2 },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -6 }],
    ...shadow.brand,
  },
  centerLabel: { fontFamily: fonts.body.extra, fontSize: 11, color: palette.green700, marginTop: -4 },
});
