// JS surface for the native Apple Maps address autocomplete (iOS only).
// On Android the native module is absent, so `requireOptionalNativeModule`
// returns null and callers fall back to plain text + geocoding.
import { requireOptionalNativeModule } from 'expo';

export type AddressSuggestion = { title: string; subtitle: string };

const native = requireOptionalNativeModule<{
  search: (query: string) => Promise<AddressSuggestion[]>;
}>('AddressAutocomplete');

/** True when native Apple Maps autocomplete is available (iOS). */
export const hasNativeAddressAutocomplete = native != null;

/** Search-as-you-type address suggestions from Apple Maps. Empty array off-iOS. */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  if (!native || query.trim().length === 0) return [];
  try {
    return await native.search(query);
  } catch {
    return [];
  }
}
