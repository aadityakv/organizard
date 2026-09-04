// Root crash boundary: a render error anywhere below shows a friendly fallback with a
// short error code instead of killing the app. Restart remounts the navigator; Zustand
// state lives outside React, so nothing is lost.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlothMark } from '@/components/brand/SlothMark';
import { Button } from '@/components/ui/Button';
import { reportError } from '@/lib/monitoring';
import { colors, type } from '@/theme';
import { copy } from '@/copy/shared';

/**
 * Stable 8-hex-char code for an error (message + throw site, djb2). Shown in
 * the fallback so a user report ("it keeps crashing, code 3f9a2c1b") can be
 * matched against console/Metro output without shipping a crash reporter.
 */
function errorDigest(error: Error): string {
  const throwSite = error.stack?.split('\n')[1]?.trim() ?? '';
  const src = `${error.name}: ${error.message}\n${throwSite}`;
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

type Props = { children: React.ReactNode };
type State = { error: Error | null; digest: string; resets: number };

/**
 * Root crash boundary (wraps the router Stack in app/_layout.tsx). On a render
 * error it shows a friendly fallback instead of killing the app. "Restart the
 * app" remounts the navigator with a fresh key — Zustand state lives outside
 * React, so no data is lost and the entry route's redirect logic re-routes to
 * the right screen. If the crash repeats, the boundary catches it again.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, digest: '', resets: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, digest: errorDigest(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary ${errorDigest(error)}]`, error, info.componentStack);
    reportError(error, {
      tags: { digest: errorDigest(error) },
      extra: { componentStack: info.componentStack },
    });
  }

  restart = () => {
    this.setState((s) => ({ error: null, digest: '', resets: s.resets + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <React.Fragment key={this.state.resets}>{this.props.children}</React.Fragment>;
    }
    return (
      <SafeAreaView style={styles.screen}>
        <SlothMark size={72} />
        <Text style={styles.title}>{copy.wellThisIsAwkward}</Text>
        <Text style={styles.body}>{copy.somethingBrokeOnThisScreen}</Text>
        <Button onPress={this.restart}>{copy.restartTheApp}</Button>
        <View style={styles.codeChip}>
          <Text style={styles.code}>error code {this.state.digest}</Text>
        </View>
        <Text style={styles.hint}>{copy.ifItKeepsHappeningQuote}</Text>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    ...type.heading,
    fontSize: 24,
    textAlign: 'center',
    color: colors.textStrong,
    marginTop: 8,
  },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  codeChip: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  code: {
    ...type.caption,
    fontFamily: 'Menlo',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  hint: {
    ...type.caption,
    color: colors.textMuted,
    opacity: 0.7,
    textAlign: 'center',
  },
});
