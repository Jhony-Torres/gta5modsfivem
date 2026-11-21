import { NextResponse } from "next/server";
import { confirmOrderPayment, flagForReview, logPaymentEvent } from "@/lib/payments";
import { parseNotification } from "@/lib/infinitepay";
import { ipFromRequest, rateLimit } from "@/lib/misc";

/**
 * Webhook do Checkout Integrado InfinitePay.
 * A notificação NÃO é assinada: tratamos como aviso e confirmamos via payment_check.
 * Resposta 200 = processado (pago ou não). 400 = erro temporário → a InfinitePay reenviará.
 */
export async function POST(req: Request) {
  if (!rateLimit(`wh:${ipFromRequest(req)}`, 300, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 100_000) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error("payload");
  } catch {
    await logPaymentEvent(null, "WEBHOOK", "INVALID_PAYLOAD");
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }
  const n = parseNotification(body);

  // Eventos de estorno/cancelamento não podem ser confirmados pela API → conciliação manual.
  if (n.event && /refund|estorn|cancel|chargeback/i.test(n.event)) {
    if (n.orderNsu) await flagForReview(n.orderNsu, "WEBHOOK", `Evento recebido: ${n.event}. Verifique na InfinitePay e atualize o pedido manualmente.`, body);
    else await logPaymentEvent(null, "WEBHOOK", "NEEDS_MANUAL_REVIEW", body, `Evento ${n.event} sem order_nsu`);
    return NextResponse.json({ ok: true });
  }

  const r = await confirmOrderPayment({
    orderNsu: n.orderNsu,
    transactionNsu: n.transactionNsu,
    slug: n.slug,
    receiptUrl: n.receiptUrl,
    source: "WEBHOOK",
    payload: body,
  });
  if (r.outcome === "CHECK_ERROR") return NextResponse.json({ ok: false, retry: true }, { status: 400 });
  return NextResponse.json({ ok: true, outcome: r.outcome });
}
