import { describe, expect, it } from 'vitest';

import { buildLabelsHtml } from './labels';

describe('buildLabelsHtml', () => {
  it('renders one label cell per box with an inline SVG QR code', () => {
    const html = buildLabelsHtml([
      { boxId: 'b1', number: 1, name: 'Pans', room: 'Kitchen' },
      { boxId: 'b2', number: 2, name: 'Books' },
    ]);
    expect(html.match(/class="label"/g)).toHaveLength(2);
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).toContain('Box #1');
    expect(html).toContain('<div class="room">Kitchen</div>');
    // A box without a room gets no empty room row.
    expect(html.match(/class="room"/g)).toHaveLength(1);
  });

  it('escapes names so a box called "<b>" cannot inject markup', () => {
    const html = buildLabelsHtml([{ boxId: 'b1', number: 1, name: 'Tom & Jerry <b>"tapes"</b>' }]);
    expect(html).toContain('Tom &amp; Jerry &lt;b&gt;&quot;tapes&quot;&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('is a complete printable document', () => {
    const html = buildLabelsHtml([]);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@page');
    expect(html).toContain('page-break-inside: avoid');
  });
});
