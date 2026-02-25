/**
 * Utilitários para campos monetários com ngx-mask (separator.2, dropSpecialCharacters: true).
 * O modelo guarda dígitos em centavos; a máscara exibe 200.000,00.
 */

/** Parse: string em centavos (ex.: "20000000") → número (200000). */
export function parseCurrencyPtBr(s: string): number | null {
  if (!s || typeof s !== 'string') return null;
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly === '') return null;
  const n = Number(digitsOnly) / 100;
  return Number.isNaN(n) ? null : n;
}

/** Número → string em centavos para o ngx-mask (ex.: 200000 → "20000000"). */
export function toRawCents(value: number): string {
  return String(Math.round(value * 100));
}
