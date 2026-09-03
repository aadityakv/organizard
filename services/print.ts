// Rendering the label sheet to a PDF and handing it to the iOS share sheet.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildLabelsHtml, type LabelInput } from '@/lib/labels';

/**
 * Build the label sheet, render it to a PDF file, and hand that file to the iOS
 * share sheet (Print · Save to Files · Mail · AirDrop…).
 *
 * Why not `Print.printAsync({ html })` directly? expo-print renders the HTML in a
 * throwaway WKWebView and presents the print dialog in the SAME call; on iOS 16+
 * that path renders a blank sheet on every print after the first — the webview
 * tears down mid-present — and stays blank until the app restarts (expo/expo
 * #19399, #27570). The PDF *render* is reliable (verified: identical output
 * across repeated calls); only the inline dialog is broken. So we render to a
 * file first and share the FILE, sidestepping the buggy print-dialog path. iOS's
 * own share sheet carries a Print action plus save/email/AirDrop.
 *
 * Returns true if the share sheet (or fallback dialog) was dispatched, false if
 * there was nothing to print or rendering failed / the user dismissed it.
 */
export async function printLabels(labels: LabelInput[]): Promise<boolean> {
  if (labels.length === 0) return false;
  try {
    const { uri } = await Print.printToFileAsync({ html: buildLabelsHtml(labels) });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Print or share labels',
      });
      return true;
    }
    // Sharing unavailable (not expected on iOS) — fall back to the print dialog.
    await Print.printAsync({ uri });
    return true;
  } catch {
    // User dismissed the sheet, or rendering/sharing failed — stay calm.
    return false;
  }
}
