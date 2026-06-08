import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { Icon } from '@/components/Icon';
import { colors, fonts, palette, radius, shadow } from '@/theme';

// Bottom nav: Boxes · Scan (center, raised) · Share — matches the design chrome.
const TABS: { name: string; icon: string; label: string; center?: boolean }[] = [
  { name: 'index', icon: 'package', label: 'Boxes' },
  { name: 'scan', icon: 'scan-line', label: 'Scan', center: true },
  { name: 'members', icon: 'users', label: 'Share' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
        const focused = state.index === routeIndex;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: state.routes[routeIndex]?.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
        };

        if (tab.center) {
          return (
            <Pressable key={tab.name} accessibilityLabel={tab.label} onPress={onPress} style={styles.centerWrap}>
              <View style={styles.centerBtn}>
                <Icon name={tab.icon} size={26} color="#fff" />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable key={tab.name} accessibilityLabel={tab.label} onPress={onPress} style={styles.tab}>
            <Icon name={tab.icon} size={24} color={focused ? palette.green700 : palette.ink400} />
            <Text style={[styles.label, { color: focused ? palette.green700 : palette.ink400 }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="members" />
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
  centerWrap: { alignItems: 'center', justifyContent: 'flex-end', minWidth: 56 },
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
});
