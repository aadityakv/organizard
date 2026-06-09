// Minimal types for the pure (no Node / no DOM) deep-imports of the `qrcode`
// package used by lib/labels.ts. The package's main entry is a server build
// that drags in PNG/terminal renderers (Buffer, fs); we deep-import only the
// matrix builder + SVG-string renderer, which ship without type declarations.

declare module 'qrcode/lib/core/qrcode' {
  export type QRCodeErrorCorrectionLevel = 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H';

  export interface QRCodeData {
    modules: { size: number; data: Uint8Array };
    version: number;
    errorCorrectionLevel: number;
    maskPattern: number;
    segments: unknown[];
  }

  export interface CreateOptions {
    version?: number;
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
    maskPattern?: number;
    toSJISFunc?: (codePoint: string) => number;
  }

  export function create(data: string, options?: CreateOptions): QRCodeData;

  const _default: { create: typeof create };
  export default _default;
}

declare module 'qrcode/lib/renderer/svg-tag' {
  import type { QRCodeData } from 'qrcode/lib/core/qrcode';

  export interface SvgRenderOptions {
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function render(qrData: QRCodeData, options?: SvgRenderOptions): string;
}
