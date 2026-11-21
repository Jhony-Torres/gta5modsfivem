import crypto from "node:crypto";
import { Prisma, type Order } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { canBuyOnSite, effectivePriceCents } from "./pricing";
import { createCheckoutLink, InfinitePayError, infinitePayStatus, paymentCheck } from "./infinitepay";

export class CheckoutError extends Error {}

export function newOrderCode() {
  // order_nsu: único, não sequencial e sem dados pessoais
  return "PTO-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function logEvent(orderId: string | null, source: string, outcome: string, payload?: unknown, error?: string) {
  try {
    await prisma.paymentEvent.create({
      data: {
        orderId,
        source,
        outcome,
        payload: payload == null ? null : JSON.stringify(payload).slice(0, 20000),
        error: error?.slice(0, 5000) ?? null,
      },
    });
  } catch (e) {
    console.error("[payments] falha ao registrar evento", e);
  }
}

/** Monta o resumo do carrinho com preços do BANCO (nunca do navegador). */
export async function quoteCart(productIds: string[], userId?: string | null) {
  const ids = [...new Set(productIds.filter((x) => typeof x === "string"))].slice(0, 50);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { versions: { where: { fileId: { not: null } } } } } },
  });
  const owned = userId
    ? new Set(
        (await prisma.entitlement.findMany({ where: { userId, productId: { in: ids }, revokedAt: null }, select: { productId: true } })).map(
          (e) => e.productId,
        ),
      )
    : new Set<string>();
  const items = ids
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const price = effectivePriceCents(p);
      let problem: string | null = null;
      if (!canBuyOnSite(p)) problem = "Este produto não está disponível para compra pelo site.";
      else if (p.deliveryType === "SITE_FILE" && p._count.versions === 0) problem = "Este produto ainda não tem arquivo disponível para entrega.";
      else if (owned.has(p.id)) problem = "Você já possui este produto.";
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        coverImage: p.coverImage,
        priceCents: price,
        originalPriceCents: p.priceCents,
        problem,
      };
    });
  const valid = items.filter((i) => !i.problem && i.priceCents != null);
  const totalCents = valid.reduce((s, i) => s + (i.priceCents ?? 0), 0);
  return { items, valid, totalCents, missing: ids.filter((id) => !products.some((p) => p.id === id)) };
}

/**
 * Cria o pedido pendente e solicita o link de checkout à InfinitePay.
 * expectedTotalCents é o total que o cliente confirmou na tela: se o preço mudou, abortamos.
 */
export async function createOrderAndCheckout(opts: {
  user: { id: string; name: string; email: string };
  productIds: string[];
  expectedTotalCents: number;
}) {
  const status = infinitePayStatus();
  if (!status.ready) throw new CheckoutError("Os pagamentos ainda não foram habilitados neste site.");

  const quote = await quoteCart(opts.productIds, opts.user.id);
  if (quote.items.some((i) => i.problem)) throw new CheckoutError("Há itens indisponíveis no carrinho. Revise o carrinho.");
  if (quote.valid.length === 0) throw new CheckoutError("Carrinho vazio.");
  if (quote.totalCents !== opts.expectedTotalCents) {
    throw new CheckoutError("Os preços foram atualizados. Confira o novo total antes de continuar.");
  }

  const products = await prisma.product.findMany({ where: { id: { in: quote.valid.map((v) => v.id) } } });
  const code = newOrderCode();
  const ttl = env.infinitepay.linkTtlMinutes;
  const expiresAt = new Date(Date.now() + ttl * 60_000);

  const order = await prisma.order.create({
    data: {
      code,
      userId: opts.user.id,
      status: "PENDING",
      totalCents: quote.totalCents,
      customerName: opts.user.name,
      customerEmail: opts.user.email,
      expiresAt,
      items: {
        create: quote.valid.map((i) => {
          const p = products.find((x) => x.id === i.id)!;
          return {
            productId: p.id,
            titleSnapshot: p.title,
            slugSnapshot: p.slug,
            unitPriceCents: i.priceCents!,
            quantity: 1,
            licenseSnapshot: [p.licenseName, p.licenseText].filter(Boolean).join("\n\n") || null,
          };
        }),
      },
    },
    include: { items: true },
  });

  try {
    const link = await createCheckoutLink({
      orderNsu: order.code,
      items: order.items.map((it) => ({ quantity: 1, price: it.unitPriceCents, description: it.titleSnapshot.slice(0, 100) })),
      redirectUrl: `${env.appUrl}/pagamento/retorno`,
      webhookUrl: `${env.appUrl}/api/webhooks/infinitepay`,
      customer: { name: opts.user.name, email: opts.user.email },
      validUntil: expiresAt,
    });
    await prisma.order.update({ where: { id: order.id }, data: { checkoutUrl: link.url } });
    await logEvent(order.id, "CREATE", "LINK_CREATED", { response: link.raw, singlePayment: Boolean(env.infinitepay.apiKey) });
    return { order, checkoutUrl: link.url };
  } catch (e) {
    const err = e as InfinitePayError;
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED", adminNotes: "Falha ao criar link de pagamento." } });
    await logEvent(order.id, "CREATE", "LINK_ERROR", err.body ?? null, err.message);
    throw new CheckoutError("Não foi possível iniciar o pagamento agora. Tente novamente em instantes.");
  }
}

export type ConfirmOutcome =
  | "PAID"
  | "ALREADY_PAID"
  | "NOT_PAID"
  | "ORDER_NOT_FOUND"
  | "MISSING_IDS"
  | "AMOUNT_MISMATCH"
  | "CONFLICT"
  | "CHECK_ERROR";

/**
 * Confirma um pagamento consultando a InfinitePay (payment_check).
 * Webhook e retorno do navegador são apenas AVISOS: só liberamos após a consulta oficial.
 * Idempotente: notificações repetidas não duplicam liberações.
 */
export async function confirmOrderPayment(params: {
  orderNsu: string | null;
  transactionNsu: string | null;
  slug: string | null;
  receiptUrl?: string | null;
  source: "WEBHOOK" | "REDIRECT" | "CHECK" | "ADMIN";
  payload?: unknown;
}): Promise<{ outcome: ConfirmOutcome; order?: Order }> {
  const { orderNsu, transactionNsu, slug, source } = params;
  if (!orderNsu) {
    await logEvent(null, source, "MISSING_IDS", params.payload, "order_nsu ausente");
    return { outcome: "MISSING_IDS" };
  }
  const order = await prisma.order.findUnique({ where: { code: orderNsu } });
  if (!order) {
    await logEvent(null, source, "ORDER_NOT_FOUND", params.payload, `order_nsu=${orderNsu}`);
    return { outcome: "ORDER_NOT_FOUND" };
  }
  if (!transactionNsu || !slug) {
    await logEvent(order.id, source, "MISSING_IDS", params.payload, "transaction_nsu/slug ausentes");
    return { outcome: "MISSING_IDS", order };
  }
  if (order.status === "PAID") {
    if (order.transactionNsu === transactionNsu) {
      await logEvent(order.id, source, "ALREADY_PAID", params.payload);
      return { outcome: "ALREADY_PAID", order };
    }
    // Outra transação para um pedido já pago: possível pagamento em duplicidade → conciliação manual.
    await logEvent(order.id, source, "CONFLICT", params.payload, `Pedido já pago com outra transação (${order.transactionNsu}).`);
    return { outcome: "CONFLICT", order };
  }
  if (order.status === "REFUNDED") {
    await logEvent(order.id, source, "CONFLICT", params.payload, "Pedido marcado como estornado; verificar manualmente.");
    return { outcome: "CONFLICT", order };
  }

  let check;
  try {
    check = await paymentCheck({ orderNsu, transactionNsu, slug });
  } catch (e) {
    const err = e as InfinitePayError;
    await logEvent(order.id, source, "CHECK_ERROR", { notice: params.payload, response: err.body }, err.message);
    return { outcome: "CHECK_ERROR", order };
  }

  if (!check.success || !check.paid) {
    await logEvent(order.id, source, "NOT_PAID", { notice: params.payload, check: check.raw });
    return { outcome: "NOT_PAID", order };
  }

  // amount = valor original cobrado (centavos). paid_amount pode ser maior (juros repassados ao comprador).
  if (check.amount !== order.totalCents || (check.paidAmount != null && check.paidAmount < order.totalCents)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "NEEDS_REVIEW", adminNotes: `Valor divergente: esperado ${order.totalCents}, InfinitePay amount=${check.amount} paid_amount=${check.paidAmount}.` },
    });
    await logEvent(order.id, source, "AMOUNT_MISMATCH", { notice: params.payload, check: check.raw });
    return { outcome: "AMOUNT_MISMATCH", order };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atualização condicional: só um processo consegue mudar o status para PAID.
      const upd = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["PENDING", "EXPIRED", "CANCELED", "FAILED", "NEEDS_REVIEW"] } },
        data: {
          status: "PAID",
          paidAt: new Date(),
          transactionNsu,
          invoiceSlug: slug,
          captureMethod: check.captureMethod,
          paidAmountCents: check.paidAmount,
          installments: check.installments,
          receiptUrl: params.receiptUrl ?? undefined,
          adminNotes:
            order.status !== "PENDING"
              ? `${order.adminNotes ? order.adminNotes + "\n" : ""}Pagamento confirmado quando o pedido estava como ${order.status}.`
              : order.adminNotes,
        },
      });
      if (upd.count === 0) return "ALREADY_PAID" as const;
      const items = await tx.orderItem.findMany({ where: { orderId: order.id, productId: { not: null } } });
      for (const it of items) {
        await tx.entitlement.upsert({
          where: { userId_productId: { userId: order.userId, productId: it.productId! } },
          update: { revokedAt: null, orderId: order.id },
          create: { userId: order.userId, productId: it.productId!, orderId: order.id },
        });
      }
      return "PAID" as const;
    });
    await logEvent(order.id, source, result, { notice: params.payload, check: check.raw });
    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    return { outcome: result, order: fresh ?? order };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // transaction_nsu já usado em outro pedido
      await prisma.order.update({ where: { id: order.id }, data: { status: "NEEDS_REVIEW" } });
      await logEvent(order.id, source, "CONFLICT", params.payload, "transaction_nsu já vinculado a outro pedido.");
      return { outcome: "CONFLICT", order };
    }
    await logEvent(order.id, source, "CHECK_ERROR", params.payload, (e as Error).message);
    return { outcome: "CHECK_ERROR", order };
  }
}

/** Marca pedidos pendentes vencidos como expirados (o link pode ainda aceitar pagamento se não houver API key). */
export async function expireStaleOrders() {
  await prisma.order.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

/** Eventos que não podem ser confirmados automaticamente (estorno/cancelamento) vão para conciliação. */
export async function flagForReview(orderNsu: string, source: string, reason: string, payload: unknown) {
  const order = await prisma.order.findUnique({ where: { code: orderNsu } });
  if (!order) {
    await logEvent(null, source, "ORDER_NOT_FOUND", payload, reason);
    return;
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}[${new Date().toISOString()}] ${reason}` },
  });
  await logEvent(order.id, source, "NEEDS_MANUAL_REVIEW", payload, reason);
}

export { logEvent as logPaymentEvent };
