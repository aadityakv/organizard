// Friendly, concrete currency formatting. Value always shows currency.
export const money = (n: number | undefined | null): string =>
  '$' + Number(n || 0).toLocaleString('en-US');
