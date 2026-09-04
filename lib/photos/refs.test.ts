import { describe, it, expect } from 'vitest';
import { isLocalRef, resolvePhoto } from '@/lib/photos/refs';

describe('isLocalRef', () => {
  it('treats local: refs as local', () => {
    expect(isLocalRef('local:photos/x.jpg')).toBe(true);
  });
  it('treats file:// and absolute paths as local (back-compat)', () => {
    expect(isLocalRef('file:///a')).toBe(true);
    expect(isLocalRef('content://a')).toBe(true);
    expect(isLocalRef('/a')).toBe(true);
  });
  it('treats a bare server photo id as not-local', () => {
    expect(isLocalRef('ph_123')).toBe(false);
  });
});

describe('resolvePhoto', () => {
  it('rejoins a local: ref with the freshly-read document directory', () => {
    const out = resolvePhoto('local:photos/x.jpg', {
      documentDirectory: 'file:///doc/',
      apiUrl: 'https://api',
      session: null,
    });
    expect(out.uri).toBe('file:///doc/photos/x.jpg');
    expect(out.headers).toBeUndefined();
  });

  it('passes a legacy absolute local path through unchanged', () => {
    const out = resolvePhoto('file:///old/cache/x.jpg', {
      documentDirectory: 'file:///doc/',
      apiUrl: 'https://api',
      session: 's',
    });
    expect(out.uri).toBe('file:///old/cache/x.jpg');
    expect(out.headers).toBeUndefined();
  });

  it('builds an authed server url for a photo id when a session exists', () => {
    const out = resolvePhoto('ph_123', {
      documentDirectory: 'file:///doc/',
      apiUrl: 'https://api',
      session: 's',
    });
    expect(out.uri).toBe('https://api/v1/photos/ph_123');
    expect(out.headers?.Authorization).toBe('Bearer s');
  });

  it('omits headers for a server photo id when there is no session', () => {
    const out = resolvePhoto('ph_123', {
      documentDirectory: 'file:///doc/',
      apiUrl: 'https://api',
      session: null,
    });
    expect(out.uri).toBe('https://api/v1/photos/ph_123');
    expect(out.headers).toBeUndefined();
  });
});
