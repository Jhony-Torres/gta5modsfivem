import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { confirmOrderPayment, logPaymentEvent } from "@/lib/payments";
import { parseNotification } from "@/lib/infinitepay";
import { Notice, OrderStatusBadge, PageHeader } from "@/components/ui";
import { ClearCartOnMount } from "@/components/cart";

export const metadata = { title: "Retorno do pagamento", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Página para onde a InfinitePay redireciona o comprador.
 * Os parâmetros recebidos NÃO são confiáveis: usamos apenas para consultar o payment_check.
 */
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const n = parseNotification(sp as Record<string, unknown>);
  const user = await getCurrentUser();

  let outcome: string | null = null;
  if (n.orderNsu) {
    const order = await prisma.order.findUnique({ where: { code: n.orderNsu } });
    if (order) {
      if (order.status !== "PAID" && n.transactionNsu && n.slug) {
        const r = await confirmOrderPayment({
          orderNsu: n.orderNsu,
          transactionNsu: n.transactionNsu,
          slug: n.slug,
          receiptUrl: n.receiptUrl,
          source: "REDIRECT",
          payload: { order_nsu: n.orderNsu, transaction_nsu: n.transactionNsu, slug: n.slug, capture_method: n.captureMethod },
        });
        outcome = r.outcome;
      } else if (order.status !== "PAID") {
        await logPaymentEvent(order.id, "REDIRECT", "MISSING_IDS", sp);
      }
    }
  }
  const order = n.orderNsu ? await prisma.order.findUnique({ where: { code: n.orderNsu } }) : null;
  const mine = order && user && order.userId === user.id;

  return (
    <>
      <PageHeader title="Pagamento" />
      <div className="container-pto mt-8 max-w-2xl space-y-4">
        {!order ? (
          <Notice tone="warn">Não encontramos o pedido informado. Se você concluiu um pagamento, confira em <Link className="underline" href="/conta/pedidos">Meus pedidos</Link>.</Notice>
        ) : order.status === "PAID" ? (
          <>
            <ClearCartOnMount />
            <Notice tone="ok" title="Pagamento confirmado!">
              A InfinitePay confirmou o pagamento e seus produtos foram liberados.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Link href="/conta/produtos" className="btn-primary">Ir para Meus produtos</Link>
              {mine && <Link href={`/conta/pedidos/${order.code}`} className="btn-secondary">Ver pedido</Link>}
            </div>
          </>
        ) : (
          <>
            <Notice tone="warn" title="Aguardando confirmação">
              Ainda não recebemos a confirmação oficial deste pagamento{outcome === "CHECK_ERROR" ? " (falha temporária ao consultar a InfinitePay)" : ""}. Isso pode levar alguns instantes.
              Seus produtos serão liberados automaticamente quando a InfinitePay confirmar.
            </Notice>
            <p className="text-sm">
              Situação atual: <OrderStatusBadge status={order.status} />
            </p>
            {mine && <Link href={`/conta/pedidos/${order.code}`} className="btn-secondary">Acompanhar pedido</Link>}
          </>
        )}
      </div>
    </>
  );
}
