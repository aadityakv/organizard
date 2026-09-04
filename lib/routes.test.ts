import { describe, expect, it } from 'vitest';

import { routes } from './routes';

describe('routes', () => {
  it('builds entity paths from ids', () => {
    expect(routes.box('b1')).toBe('/box/b1');
    expect(routes.streamCapture('b1')).toBe('/stream/b1?view=capture');
  });
  it('URL-encodes invite tokens', () => {
    expect(routes.invite('a/b c')).toBe('/invite?token=a%2Fb%20c');
  });
});
