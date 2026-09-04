// Rendering the label sheet to a PDF and handing it to the iOS share sheet.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildLabelsHtml, type LabelInput } from '@/lib/qr/labels';

/**
 * Render the label sheet to a PDF file and hand it to the iOS share sheet.
 * Not Print.printAsync({ html }): on iOS 16+ it renders blank on every print after the first
 * (expo/expo #19399); rendering to a file is reliable, and the share sheet still offers Print.
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
