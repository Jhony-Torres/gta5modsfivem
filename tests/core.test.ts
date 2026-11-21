import { describe, expect, it, beforeAll } from "vitest";
import { formatBRL, parseBRLToCents } from "../src/lib/money";
import { canBuyOnSite, effectivePriceCents } from "../src/lib/pricing";
import { extractCheckoutUrl, parseNotification } from "../src/lib/infinitepay";

beforeAll(() => {
  process.env.APP_SECRET = "x".repeat(48);
});

describe("dinheiro", () => {
  it("converte formatos brasileiros para centavos", () => {
    expect(parseBRLToCents("19,90")).toBe(1990);
    expect(parseBRLToCents("R$ 1.234,56")).toBe(123456);
    expect(parseBRLToCents("10")).toBe(1000);
    expect(parseBRLToCents("10.5")).toBe(1050);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("-5")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatBRL(1990).replace(/\s/g, " ")).toBe("R$ 19,90");
  });
});

const base = { pricingType: "PAID" as const, priceCents: 5000, promoPriceCents: null as number | null, promoEndsAt: null as Date | null };

describe("preço efetivo", () => {
  it("gratuito vale zero", () => expect(effectivePriceCents({ ...base, pricingType: "FREE" })).toBe(0));
  it("pago sem preço não tem valor (não vira gratuito)", () => expect(effectivePriceCents({ ...base, priceCents: null })).toBeNull());
  it("aplica promoção válida", () => expect(effectivePriceCents({ ...base, promoPriceCents: 3000 })).toBe(3000));
  it("ignora promoção vencida", () =>
    expect(effectivePriceCents({ ...base, promoPriceCents: 3000, promoEndsAt: new Date(Date.now() - 1000) })).toBe(5000));
  it("ignora promoção maior que o preço", () => expect(effectivePriceCents({ ...base, promoPriceCents: 9000 })).toBe(5000));
  it("só vende pelo site com revisão de conformidade e checkout InfinitePay", () => {
    const p = { ...base, status: "PUBLISHED" as const, checkoutType: "INFINITEPAY" as const, complianceStatus: "REVIEWED_OK" as const };
    expect(canBuyOnSite(p)).toBe(true);
    expect(canBuyOnSite({ ...p, complianceStatus: "NOT_REVIEWED" })).toBe(false);
    expect(canBuyOnSite({ ...p, checkoutType: "TEBEX" })).toBe(false);
    expect(canBuyOnSite({ ...p, priceCents: 50 })).toBe(false); // abaixo do mínimo R$ 1,00
    expect(canBuyOnSite({ ...p, status: "DRAFT" })).toBe(false);
  });
});

describe("InfinitePay", () => {
  it("extrai a URL do checkout em variações de resposta", () => {
    expect(extractCheckoutUrl({ url: "https://checkout.infinitepay.io/x" })).toBe("https://checkout.infinitepay.io/x");
    expect(extractCheckoutUrl({ checkout_url: "https://a.b/c" })).toBe("https://a.b/c");
    expect(extractCheckoutUrl({ url: "http://inseguro" })).toBeNull();
    expect(extractCheckoutUrl(null)).toBeNull();
  });
  it("lê os identificadores do webhook e do retorno", () => {
    const n = parseNotification({ order_nsu: "PTO-1", transaction_nsu: "tx", invoice_slug: "sl", amount: 100 });
    expect(n).toMatchObject({ orderNsu: "PTO-1", transactionNsu: "tx", slug: "sl" });
    expect(parseNotification({ order_nsu: "PTO-1", slug: "s2" }).slug).toBe("s2");
  });
});

describe("tokens assinados", async () => {
  const { signToken, verifyToken } = await import("../src/lib/crypto");
  it("valida token íntegro e recusa adulterado ou vencido", () => {
    const t = signToken({ f: "file1" }, 60);
    expect(verifyToken<{ f: string }>(t)?.f).toBe("file1");
    const [body, sig] = t.split(".");
    expect(verifyToken(body + "x." + sig)).toBeNull();
    expect(verifyToken(signToken({ f: "a" }, -10))).toBeNull();
  });
});
