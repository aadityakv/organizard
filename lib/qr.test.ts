import { describe, expect, it } from 'vitest';

import { classifyScan, encodeBoxQR, parseBoxQR, QR_PREFIX } from './qr';

describe('box QR payloads', () => {
  it('round-trips a box id through the tuck:// scheme', () => {
    expect(encodeBoxQR('b_123')).toBe(`${QR_PREFIX}b_123`);
    expect(parseBoxQR(encodeBoxQR('b_123'))).toBe('b_123');
  });

  it('still reads labels printed before the rebrand', () => {
    expect(parseBoxQR('organizard://box/b_old')).toBe('b_old');
  });

  it('rejects anything that is not a Tuck code', () => {
    expect(parseBoxQR('https://example.com')).toBeNull();
    expect(parseBoxQR('')).toBeNull();
  });
});

describe('classifyScan', () => {
  const current = ['b1', 'b2'];
  const others = [{ id: 'm2', name: 'Storage unit', boxIds: ['b9'] }];

  it('finds a box in the current move', () => {
    expect(classifyScan(encodeBoxQR('b1'), current, others)).toEqual({ kind: 'thisMove', boxId: 'b1' });
  });

  it('offers a jump when the box lives in another move on the device', () => {
    expect(classifyScan(encodeBoxQR('b9'), current, others)).toEqual({
      kind: 'otherMove',
      boxId: 'b9',
      moveId: 'm2',
      moveName: 'Storage unit',
    });
  });

  it('treats an unknown Tuck code as a box we cannot see', () => {
    expect(classifyScan(encodeBoxQR('b404'), current, others)).toEqual({ kind: 'noAccess' });
  });

  it('reports non-Tuck codes as unknown with the raw value', () => {
    expect(classifyScan('WIFI:S=home;;', current)).toEqual({ kind: 'unknown', value: 'WIFI:S=home;;' });
  });
});
