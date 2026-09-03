import { describe, expect, it } from 'vitest';

import { PERM, ROLE_BLURB, ROLE_ICON, ROLE_LABEL } from './permissions';

describe('PERM', () => {
  it('owners and editors edit; only owners manage members or delete', () => {
    expect(PERM.canEdit('owner')).toBe(true);
    expect(PERM.canEdit('editor')).toBe(true);
    expect(PERM.canEdit('viewer')).toBe(false);

    expect(PERM.canManage('owner')).toBe(true);
    expect(PERM.canManage('editor')).toBe(false);

    expect(PERM.canDelete('owner')).toBe(true);
    expect(PERM.canDelete('editor')).toBe(false);
    expect(PERM.canDelete('viewer')).toBe(false);
  });

  it('every role has a label, blurb and icon', () => {
    for (const role of ['owner', 'editor', 'viewer'] as const) {
      expect(ROLE_LABEL[role]).toBeTruthy();
      expect(ROLE_BLURB[role]).toBeTruthy();
      expect(ROLE_ICON[role]).toBeTruthy();
    }
  });
});
