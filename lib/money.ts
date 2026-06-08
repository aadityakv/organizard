// Friendly, concrete currency formatting. Value always shows currency.
// Manual thousands grouping (Number.toLocaleString does not group on Android Hermes
// without an Intl polyfill). Whole dollars, matching the design.
export const money = (n: number | undefined | null): string =>
  '$' + Math.round(Number(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
