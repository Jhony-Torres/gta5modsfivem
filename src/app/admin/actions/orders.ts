"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { audit } from "@/lib/misc";
import { confirmOrderPayment, logPaymentEvent } from "@/lib/payments";
import type { ActionState } from "@/components/forms";

/** Conciliação: consulta a InfinitePay com transaction_nsu e slug informados pelo administrador. */
export async function adminCheckPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const order = await prisma.order.findUnique({ where: { id: String(fd.get("orderId")) } });
  if (!order) return { error: "Pedido não encontrado." };
  const transactionNsu = String(fd.get("transactionNsu") || "").trim() || order.transactionNsu;
  const slug = String(fd.get("slug") || "").trim() || order.invoiceSlug;
  if (!transactionNsu || !slug) return { error: "Informe o transaction_nsu e o slug (código da fatura) que aparecem na InfinitePay." };
  const r = await confirmOrderPayment({ orderNsu: order.code, transactionNsu, slug, source: "ADMIN", payload: { by: admin.id } });
  await audit(admin.id, "order.check", "Order", order.id, { outcome: r.outcome });
  revalidatePath(`/admin/pedidos/${order.id}`);
  const map: Record<string, ActionState> = {
    PAID: { ok: true, message: "Pagamento confirmado pela InfinitePay. Produtos liberados." },
    ALREADY_PAID: { ok: true, message: "Pedido já estava pago." },
    NOT_PAID: { error: "A InfinitePay não confirmou pagamento para esses dados." },
    AMOUNT_MISMATCH: { error: "Valor divergente. Pedido marcado para análise." },
    CONFLICT: { error: "Conflito: transação já usada ou pedido em estado incompatível. Veja os eventos." },
    CHECK_ERROR: { error: "Falha ao consultar a InfinitePay. Veja os eventos." },
  };
  return map[r.outcome] ?? { error: r.outcome };
}

/** Atualiza o status manualmente (ex.: estorno feito no app InfinitePay). Estorno/cancelamento revogam o acesso. */
export async function adminSetOrderStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const id = String(fd.get("orderId"));
  const status = String(fd.get("status"));
  const note = String(fd.get("note") || "").trim().slice(0, 2000);
  if (!["REFUNDED", "CANCELED", "NEEDS_REVIEW", "PENDING"].includes(status)) return { error: "Status inválido." };
  if (!note) return { error: "Descreva o motivo (fica registrado para conciliação)." };
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { error: "Pedido não encontrado." };
  if (status === "PENDING" && order.status === "PAID") return { error: "Um pedido pago não volta para pendente." };
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        status: status as "REFUNDED",
        adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}[${new Date().toISOString()}] ${status}: ${note}`,
      },
    });
    if (status === "REFUNDED" || status === "CANCELED") {
      await tx.entitlement.updateMany({ where: { orderId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  });
  await logPaymentEvent(id, "ADMIN", `SET_${status}`, { by: admin.id, note });
  await audit(admin.id, "order.status", "Order", id, { from: order.status, to: status, note });
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true, message: "Pedido atualizado." };
}

/** Concede ou revoga acesso manualmente (ex.: entrega manual, cortesia). Fica no log. */
export async function adminEntitlementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const productId = String(fd.get("productId") || "");
  const op = fd.get("op") === "revoke" ? "revoke" : "grant";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Usuário não encontrado." };
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Produto não encontrado." };
  if (op === "grant") {
    await prisma.entitlement.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      update: { revokedAt: null },
      create: { userId: user.id, productId },
    });
  } else {
    await prisma.entitlement.updateMany({ where: { userId: user.id, productId }, data: { revokedAt: new Date() } });
  }
  await audit(admin.id, `entitlement.${op}`, "Product", productId, { userId: user.id });
  return { ok: true, message: op === "grant" ? "Acesso concedido." : "Acesso revogado." };
}
