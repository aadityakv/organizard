// ============================================================
// Printable QR labels: builds the print-ready HTML sheet of box
// labels (QR + box #, name, room). Pure — rendering it to a PDF
// and sharing it is services/print.ts.
//
// QR rendering is done as INLINE SVG via the `qrcode` package's
// pure (no Node / no DOM) modules — deep-imported so we skip the
// PNG/canvas/terminal renderers and their Buffer/document deps.
// SVG keeps the codes crisp at any print scale (vector) and lets
// the whole label build live here in plain TS — no hidden RN
// render pass, no base64 round-trip.
// ============================================================

import { encodeBoxQR } from './qr';

// The `qrcode` package ships its `main` as a server build that pulls in
// PNG/terminal renderers (Buffer, fs). We only want the matrix builder + the
// SVG string renderer, both of which are pure JS. Deep-import them directly.
// Typed via types/qrcode-core.d.ts.
import QRCodeCore from 'qrcode/lib/core/qrcode';
import * as SvgRenderer from 'qrcode/lib/renderer/svg-tag';

// App palette echoed as literals — the print sheet is plain HTML, so it can't
// reach the RN theme objects. Kept in sync with theme/tokens.ts.
const INK_900 = '#2A2722';
const INK_500 = '#6F6A5E';
const INK_400 = '#918B7C';
const SAND_300 = '#E4E1D7';

export type LabelInput = {
  /** Box id — encoded into the QR via encodeBoxQR. */
  boxId: string;
  number: number;
  name: string;
  room?: string;
};

/** Build the scannable QR for a box as an inline SVG string (vector, crisp). */
function qrSvg(boxId: string): string {
  const matrix = QRCodeCore.create(encodeBoxQR(boxId), { errorCorrectionLevel: 'M' });
  // margin:0 — we add our own padding in CSS. light alpha 0 → transparent bg.
  return SvgRenderer.render(matrix, {
    margin: 0,
    color: { dark: INK_900, light: '#0000' },
  });
}

/** Minimal HTML escaping for box/room names embedded in the sheet. */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function labelCell(label: LabelInput): string {
  const room = label.room ? `<div class="room">${esc(label.room)}</div>` : '';
  return `
    <div class="label">
      <div class="qr">${qrSvg(label.boxId)}</div>
      <div class="meta">
        <div class="num">Box #${label.number}</div>
        <div class="name">${esc(label.name)}</div>
        ${room}
      </div>
    </div>`;
}

/**
 * Build a print-ready HTML page: a responsive 3-column grid of label cells,
 * each with the box's QR, number, name, and room. Sized for Letter/A4 with
 * page margins; labels avoid breaking across pages.
 */
export function buildLabelsHtml(labels: LabelInput[]): string {
  const cells = labels.map(labelCell).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: ${INK_900};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10mm;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 4mm;
    padding: 4mm;
    border: 1.2px solid ${SAND_300};
    border-radius: 4mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .qr {
    flex: 0 0 auto;
    width: 24mm;
    height: 24mm;
  }
  .qr svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .meta {
    min-width: 0;
    flex: 1 1 auto;
  }
  .num {
    font-size: 11pt;
    font-weight: 700;
    line-height: 1.2;
  }
  .name {
    font-size: 9.5pt;
    font-weight: 600;
    color: ${INK_500};
    margin-top: 0.6mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .room {
    font-size: 8pt;
    font-weight: 600;
    color: ${INK_400};
    margin-top: 0.6mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="grid">${cells}</div>
</body>
</html>`;
}
