const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return fmt.format(cents / 100);
}

/** Converte "19,90", "19.90", "R$ 1.234,56" em centavos. Retorna null se inválido. */
export function parseBRLToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
