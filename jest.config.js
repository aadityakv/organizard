// Component tests (React Native Testing Library) run under jest-expo; logic tests
// stay on vitest. Component tests are named *.ui.test.tsx so neither runner picks
// up the other's files.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.ui.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native))',
  ],
};
