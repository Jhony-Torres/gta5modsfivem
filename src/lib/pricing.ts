import type { Product } from "@prisma/client";

type PriceFields = Pick<Product, "pricingType" | "priceCents" | "promoPriceCents" | "promoEndsAt">;

/** Preço efetivo calculado no servidor a partir do banco. null = sem preço definido. */
export function effectivePriceCents(p: PriceFields, now = new Date()): number | null {
  if (p.pricingType === "FREE") return 0;
  if (p.priceCents == null || p.priceCents <= 0) return null;
  if (
    p.promoPriceCents != null &&
    p.promoPriceCents > 0 &&
    p.promoPriceCents < p.priceCents &&
    (!p.promoEndsAt || p.promoEndsAt > now)
  ) {
    return p.promoPriceCents;
  }
  return p.priceCents;
}

export function isPromoActive(p: PriceFields, now = new Date()) {
  const e = effectivePriceCents(p, now);
  return p.pricingType === "PAID" && e != null && p.priceCents != null && e < p.priceCents;
}

export const MIN_INFINITEPAY_CENTS = 100; // mínimo informado pela InfinitePay: R$ 1,00

/** Produto pago pode ser comprado pelo checkout do próprio site? */
export function canBuyOnSite(
  p: PriceFields & Pick<Product, "checkoutType" | "complianceStatus" | "status">,
) {
  return (
    p.status === "PUBLISHED" &&
    p.pricingType === "PAID" &&
    p.checkoutType === "INFINITEPAY" &&
    p.complianceStatus === "REVIEWED_OK" &&
    (effectivePriceCents(p) ?? 0) >= MIN_INFINITEPAY_CENTS
  );
}
