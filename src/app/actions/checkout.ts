"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CheckoutError, confirmOrderPayment, createOrderAndCheckout } from "@/lib/payments";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/misc";
import type { ActionState } from "@/components/forms";

export async function startCheckoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para continuar." };
  if (!rateLimit(`checkout:${user.id}`, 10, 10 * 60_000).ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  if (fd.get("confirm") !== "on") return { error: "Confirme o valor e os itens do pedido para continuar." };
  const ids = String(fd.get("ids") || "").split(",").filter(Boolean);
  const expected = Number(fd.get("expectedTotal"));
  let url: string;
  try {
    const r = await createOrderAndCheckout({ user, productIds: ids, expectedTotalCents: expected });
    url = r.checkoutUrl;
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    console.error("[checkout]", e);
    return { error: "Erro inesperado ao iniciar o pagamento." };
  }
  redirect(url);
}

/** O comprador pede para verificar o pagamento de um pedido seu (usa os dados recebidos no retorno/webhook). */
export async function recheckOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta." };
  if (!rateLimit(`recheck:${user.id}`, 6, 5 * 60_000).ok) return { error: "Aguarde alguns minutos antes de verificar novamente." };
  const order = await prisma.order.findFirst({ where: { code: String(fd.get("code") || ""), userId: user.id } });
  if (!order) return { error: "Pedido não encontrado." };
  if (order.status === "PAID") return { ok: true, message: "Pagamento já confirmado." };
  const lastWithIds = await prisma.paymentEvent.findMany({ where: { orderId: order.id, source: { in: ["WEBHOOK", "REDIRECT"] } }, orderBy: { createdAt: "desc" }, take: 10 });
  let ids: { transactionNsu: string | null; slug: string | null } = { transactionNsu: order.transactionNsu, slug: order.invoiceSlug };
  for (const ev of lastWithIds) {
    try {
      const p = JSON.parse(ev.payload || "{}");
      const n = p.notice ?? p;
      if (n?.transaction_nsu && (n?.invoice_slug || n?.slug)) {
        ids = { transactionNsu: String(n.transaction_nsu), slug: String(n.invoice_slug ?? n.slug) };
        break;
      }
    } catch {}
  }
  if (!ids.transactionNsu || !ids.slug) {
    return { error: "Ainda não recebemos nenhuma notificação de pagamento deste pedido. Se você já pagou, aguarde alguns minutos ou fale com o suporte informando o código do pedido." };
  }
  const r = await confirmOrderPayment({ orderNsu: order.code, transactionNsu: ids.transactionNsu, slug: ids.slug, source: "CHECK" });
  if (r.outcome === "PAID" || r.outcome === "ALREADY_PAID") return { ok: true, message: "Pagamento confirmado! Seus produtos foram liberados." };
  if (r.outcome === "NOT_PAID") return { error: "A InfinitePay ainda não confirmou este pagamento." };
  if (r.outcome === "CHECK_ERROR") return { error: "Não foi possível consultar a InfinitePay agora. Tente novamente em instantes." };
  return { error: "O pedido precisa de análise da equipe. Fale com o suporte informando o código do pedido." };
}
