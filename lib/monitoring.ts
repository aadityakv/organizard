// Crash and error reporting. A no-op until a Sentry DSN is configured (SENTRY_DSN at
// build time → extra.sentryDsn), so local and simulator builds stay quiet.
import type React from 'react';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ?? '';
const appEnv = (Constants.expoConfig?.extra?.appEnv as string | undefined) ?? 'production';

const monitoringEnabled = dsn.length > 0;

/** Start the SDK once at app boot; safe to call when monitoring is disabled. */
export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn,
    environment: appEnv,
    release: `${Constants.expoConfig?.slug}@${Constants.expoConfig?.version}`,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/** Report an error with optional structured context (tags stay low-cardinality). */
export function reportError(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { tags: context?.tags, extra: context?.extra });
}

/** Wrap the root component so navigation and touch events get breadcrumbs. */
export function wrapRoot<P extends object>(component: React.ComponentType<P>): React.ComponentType<P> {
  if (!monitoringEnabled) return component;
  // Sentry types its wrapper on a loose props record; the wrapped component keeps ours.
  const wrapped = Sentry.wrap(component as unknown as React.ComponentType<Record<string, unknown>>);
  return wrapped as unknown as React.ComponentType<P>;
}
