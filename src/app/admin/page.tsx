import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, missingSettings } from "@/lib/settings";
import { infinitePayStatus } from "@/lib/infinitepay";
import { expireStaleOrders } from "@/lib/payments";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/misc";
import { mailConfigured } from "@/lib/mail";
import { Notice } from "@/components/ui";

export default async function AdminHome() {
  await expireStaleOrders();
  const since30 = new Date(Date.now() - 30 * 864e5);
  const [s, products, published, users, paidAgg, paid30, ordersByStatus, downloads, downloads30, reviewEvents, pendingPages, pendingSugg, notReviewed, topSales, topDl] = await Promise.all([
    getSettings(),
    prisma.product.count(),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count(),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true }, _count: true }),
    prisma.order.aggregate({ where: { status: "PAID", paidAt: { gte: since30 } }, _sum: { totalCents: true }, _count: true }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.download.count(),
    prisma.download.count({ where: { createdAt: { gte: since30 } } }),
    prisma.paymentEvent.findMany({
      where: { outcome: { in: ["NEEDS_MANUAL_REVIEW", "AMOUNT_MISMATCH", "CONFLICT", "CHECK_ERROR", "ORDER_NOT_FOUND"] }, createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { order: { select: { code: true, id: true } } },
    }),
    prisma.page.count({ where: { needsReview: true } }),
    prisma.suggestion.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { pricingType: "PAID", checkoutType: "INFINITEPAY", complianceStatus: { not: "REVIEWED_OK" } } }),
    prisma.orderItem.groupBy({ by: ["titleSnapshot"], where: { order: { status: "PAID" } }, _count: true, _sum: { unitPriceCents: true }, orderBy: { _count: { titleSnapshot: "desc" } }, take: 5 }),
    prisma.product.findMany({ where: { downloadCount: { gt: 0 } }, orderBy: { downloadCount: "desc" }, take: 5, select: { id: true, title: true, downloadCount: true } }),
  ]);
  const ip = infinitePayStatus();
  const missing = missingSettings(s);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Visão geral</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Vendas confirmadas (total)" value={formatBRL(paidAgg._sum.totalCents ?? 0)} sub={`${paidAgg._count} pedidos pagos`} />
        <Stat label="Vendas últimos 30 dias" value={formatBRL(paid30._sum.totalCents ?? 0)} sub={`${paid30._count} pedidos`} />
        <Stat label="Downloads registrados" value={downloads.toLocaleString("pt-BR")} sub={`${downloads30.toLocaleString("pt-BR")} nos últimos 30 dias`} />
        <Stat label="Produtos" value={`${published} publicados`} sub={`${products} cadastrados · ${users} usuários`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Pendências de configuração</h2>
          <Notice tone={ip.ready ? (ip.hasApiKey ? "ok" : "warn") : "warn"} title="InfinitePay">
            {!ip.hasHandle && <span className="block">INFINITEPAY_HANDLE não configurado no servidor (.env).</span>}
            {!ip.enabled && <span className="block">Cobranças desabilitadas (INFINITEPAY_ENABLED=false). Nenhum link real é criado.</span>}
            {!ip.hasApiKey && <span className="block">Sem API key: os links não terão validade nem uso único (podem aceitar mais de um pagamento).</span>}
            {!ip.isOfficialApi && <span className="block">Atenção: INFINITEPAY_API_BASE aponta para um endereço que não é o oficial (modo de teste).</span>}
            {ip.ready && ip.hasApiKey && ip.isOfficialApi && <span>Configurada e habilitada.</span>}
          </Notice>
          {!mailConfigured() && <Notice tone="warn">SMTP não configurado: recuperação de senha por e-mail indisponível.</Notice>}
          {missing.length > 0 && (
            <Notice tone="warn" title="Dados do site ainda não informados">
              <ul className="list-disc pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
              <Link href="/admin/configuracoes" className="mt-1 inline-block underline">Abrir configurações</Link>
            </Notice>
          )}
          {pendingPages > 0 && (
            <Notice tone="warn">
              {pendingPages} página(s) (regras, termos, políticas...) ainda precisam de revisão. <Link href="/admin/paginas" className="underline">Revisar</Link>
            </Notice>
          )}
          {notReviewed > 0 && (
            <Notice tone="warn">
              {notReviewed} produto(s) configurados para venda via InfinitePay sem revisão de conformidade concluída. <Link href="/admin/produtos" className="underline">Ver produtos</Link>
            </Notice>
          )}
          {pendingSugg > 0 && <Notice>{pendingSugg} sugestão(ões) aguardando análise. <Link href="/admin/sugestoes" className="underline">Analisar</Link></Notice>}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Pedidos por status</h2>
          {ordersByStatus.length === 0 ? (
            <p className="text-sm text-muted">Nenhum pedido ainda.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ordersByStatus.map((o) => (
                <li key={o.status} className="flex justify-between">
                  <Link href={`/admin/pedidos?status=${o.status}`} className="hover:text-sun">{o.status}</Link>
                  <span>{o._count}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-5 font-semibold">Eventos de pagamento que pedem atenção (30 dias)</h2>
          {reviewEvents.length === 0 ? (
            <p className="text-sm text-muted">Nada pendente.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {reviewEvents.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>
                    <span className="text-warn">{e.outcome}</span> · {e.source}{" "}
                    {e.order && <Link href={`/admin/pedidos/${e.order.id}`} className="text-sun underline">{e.order.code}</Link>}
                  </span>
                  <span className="text-xs text-muted">{formatDate(e.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Mais vendidos (pedidos pagos)</h2>
          {topSales.length === 0 ? <p className="text-sm text-muted">Sem vendas confirmadas.</p> : (
            <ul className="space-y-1.5 text-sm">
              {topSales.map((t) => (
                <li key={t.titleSnapshot} className="flex justify-between gap-3"><span>{t.titleSnapshot}</span><span className="text-muted">{t._count} · {formatBRL(t._sum.unitPriceCents ?? 0)}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Mais baixados</h2>
          {topDl.length === 0 ? <p className="text-sm text-muted">Sem downloads registrados.</p> : (
            <ul className="space-y-1.5 text-sm">
              {topDl.map((t) => (
                <li key={t.id} className="flex justify-between gap-3"><Link href={`/admin/produtos/${t.id}`} className="hover:text-sun">{t.title}</Link><span className="text-muted">{t.downloadCount}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
