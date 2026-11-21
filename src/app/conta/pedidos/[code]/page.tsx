import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { expireStaleOrders } from "@/lib/payments";
import { formatBRL } from "@/lib/money";
import { formatDate, safeUrl } from "@/lib/misc";
import { Notice, OrderStatusBadge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { recheckOrderAction } from "@/app/actions/checkout";

export const metadata = { title: "Pedido" };

const HELP: Record<string, string> = {
  PENDING: "Aguardando a confirmação do pagamento pela InfinitePay. Se você ainda não pagou, use o botão abaixo.",
  EXPIRED: "O prazo deste pedido terminou. Se você já pagou, clique em verificar pagamento; caso contrário, faça um novo pedido pelo carrinho.",
  FAILED: "Não foi possível gerar o pagamento deste pedido. Faça um novo pedido pelo carrinho.",
  CANCELED: "Pedido cancelado.",
  REFUNDED: "Pagamento estornado. O acesso aos produtos deste pedido foi removido.",
  NEEDS_REVIEW: "Este pedido está em análise pela equipe. Fale com o suporte se precisar.",
};

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/conta/pedidos/${code}`);
  await expireStaleOrders();
  const order = await prisma.order.findFirst({ where: { code, userId: user.id }, include: { items: true } });
  if (!order) notFound();
  const checkoutUrl = safeUrl(order.checkoutUrl);
  const receipt = safeUrl(order.receiptUrl);

  return (
    <div className="space-y-4">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Pedido {order.code}</h2>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Criado em {formatDate(order.createdAt, true)}{order.paidAt ? ` · Pago em ${formatDate(order.paidAt, true)}` : ""}</p>
        {HELP[order.status] && <div className="mt-4"><Notice tone={order.status === "PENDING" ? "info" : "warn"}>{HELP[order.status]}</Notice></div>}
        <ul className="mt-4 divide-y divide-line text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2.5">
              <Link href={`/mods/${i.slugSnapshot}`} className="hover:text-sun">{i.titleSnapshot}</Link>
              <span>{formatBRL(i.unitPriceCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
          <span>Total</span>
          <span>{formatBRL(order.totalCents)}</span>
        </div>
        {order.paidAmountCents != null && order.paidAmountCents !== order.totalCents && (
          <p className="mt-1 text-right text-xs text-muted">Valor pago na InfinitePay (com encargos do parcelamento): {formatBRL(order.paidAmountCents)}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {order.status === "PAID" && <Link href="/conta/produtos" className="btn-primary">Acessar meus produtos</Link>}
          {receipt && <a href={receipt} target="_blank" rel="noopener noreferrer" className="btn-secondary">Ver comprovante</a>}
          {order.status === "PENDING" && checkoutUrl && <a href={checkoutUrl} className="btn-primary">Ir para o pagamento</a>}
        </div>
      </div>
      {order.status !== "PAID" && order.status !== "REFUNDED" && order.status !== "FAILED" && (
        <div className="card p-5">
          <h3 className="font-semibold">Já pagou?</h3>
          <p className="mb-3 mt-1 text-sm text-muted">Verificamos diretamente com a InfinitePay. A liberação é automática após a confirmação.</p>
          <ActionForm action={recheckOrderAction}>
            <input type="hidden" name="code" value={order.code} />
            <SubmitButton className="btn-secondary" pendingText="Verificando...">Verificar pagamento</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
