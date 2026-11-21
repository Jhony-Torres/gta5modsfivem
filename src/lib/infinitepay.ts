import { env } from "./env";

/**
 * Cliente do Checkout Integrado InfinitePay.
 * Documentação: https://www.infinitepay.io/checkout-documentacao
 *
 *  POST {base}/links          -> cria link de pagamento (preços em centavos)
 *  POST {base}/payment_check  -> confirma se um pagamento foi realmente aprovado
 *
 * Observações da documentação (consultada em nov/2026):
 *  - Não há sandbox: qualquer link criado é real.
 *  - O webhook NÃO tem assinatura → sempre confirmar com payment_check.
 *  - Links não podem ser cancelados pela API; use valid_until e single_payment (exigem API key).
 *  - Estornos/cancelamentos são feitos apenas no App/Conta Web InfinitePay.
 */

export type CheckoutItem = { quantity: number; price: number; description: string };

export type CreateLinkInput = {
  orderNsu: string;
  items: CheckoutItem[];
  redirectUrl: string;
  webhookUrl: string;
  customer?: { name?: string; email?: string };
  validUntil?: Date;
};

export type CreateLinkResult = { url: string; raw: unknown };

export type PaymentCheckResult = {
  success: boolean;
  paid: boolean;
  amount: number | null;
  paidAmount: number | null;
  installments: number | null;
  captureMethod: string | null;
  raw: unknown;
};

export class InfinitePayError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

export function infinitePayStatus() {
  const ip = env.infinitepay;
  return {
    enabled: ip.enabled,
    hasHandle: Boolean(ip.handle),
    hasApiKey: Boolean(ip.apiKey),
    isOfficialApi: ip.apiBase === "https://api.checkout.infinitepay.io",
    ready: ip.enabled && Boolean(ip.handle),
  };
}

async function post(path: string, body: unknown, timeoutMs = 10000) {
  const ip = env.infinitepay;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (ip.apiKey) headers["X-Api-Key"] = ip.apiKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ip.apiBase + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { nonJsonBody: text.slice(0, 2000) };
    }
    if (!res.ok) throw new InfinitePayError(`InfinitePay respondeu HTTP ${res.status}`, res.status, json);
    return json;
  } catch (e) {
    if (e instanceof InfinitePayError) throw e;
    throw new InfinitePayError(`Falha de comunicação com a InfinitePay: ${(e as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}

/** A documentação não nomeia o campo da URL na resposta; aceitamos as variações mais prováveis. */
export function extractCheckoutUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const candidates = [r.url, r.checkout_url, r.link, r.payment_url, (r.data as Record<string, unknown> | undefined)?.url];
  for (const c of candidates) {
    if (typeof c === "string" && /^https:\/\//.test(c)) return c;
  }
  return null;
}

export async function createCheckoutLink(input: CreateLinkInput): Promise<CreateLinkResult> {
  const ip = env.infinitepay;
  if (!ip.handle && !ip.apiKey) throw new InfinitePayError("INFINITEPAY_HANDLE não configurado.");
  const body: Record<string, unknown> = {
    order_nsu: input.orderNsu,
    items: input.items,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
  };
  if (ip.handle) body.handle = ip.handle;
  if (input.customer?.name || input.customer?.email) {
    body.customer = { name: input.customer.name, email: input.customer.email };
  }
  // Opções de uso único e validade só funcionam com API key (conforme documentação).
  if (ip.apiKey) {
    body.options = {
      single_payment: true,
      ...(input.validUntil ? { valid_until: input.validUntil.toISOString() } : {}),
    };
  }
  const raw = await post("/links", body);
  const url = extractCheckoutUrl(raw);
  if (!url) throw new InfinitePayError("Resposta da InfinitePay sem URL de checkout reconhecível.", 200, raw);
  return { url, raw };
}

export async function paymentCheck(params: { orderNsu: string; transactionNsu: string; slug: string }): Promise<PaymentCheckResult> {
  const body: Record<string, unknown> = {
    order_nsu: params.orderNsu,
    transaction_nsu: params.transactionNsu,
    slug: params.slug,
  };
  if (env.infinitepay.handle) body.handle = env.infinitepay.handle;
  const raw = (await post("/payment_check", body)) as Record<string, unknown> | null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  return {
    success: raw?.success === true,
    paid: raw?.paid === true,
    amount: n(raw?.amount),
    paidAmount: n(raw?.paid_amount),
    installments: n(raw?.installments),
    captureMethod: typeof raw?.capture_method === "string" ? (raw.capture_method as string) : null,
    raw,
  };
}

/** Extrai os identificadores de um webhook ou dos parâmetros de retorno. */
export function parseNotification(data: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : typeof v === "number" ? String(v) : null);
  return {
    orderNsu: s(data.order_nsu),
    transactionNsu: s(data.transaction_nsu),
    slug: s(data.invoice_slug) ?? s(data.slug),
    receiptUrl: s(data.receipt_url),
    captureMethod: s(data.capture_method),
    event: s(data.event) ?? s(data.type) ?? s(data.status),
  };
}
