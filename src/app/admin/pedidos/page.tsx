import Link from "next/link";
import { prisma } from "@/lib/db";
import { expireStaleOrders } from "@/lib/payments";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/misc";
import { EmptyState, ORDER_STATUS_LABEL, OrderStatusBadge } from "@/components/ui";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  await expireStaleOrders();
  const orders = await prisma.order.findMany({
    where: {
      ...(status && status in ORDER_STATUS_LABEL ? { status: status as "PAID" } : {}),
      ...(q ? { OR: [{ code: { contains: q } }, { customerEmail: { contains: q } }, { transactionNsu: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { items: { select: { titleSnapshot: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Pedidos e pagamentos</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Código, e-mail ou transaction_nsu" className="input max-w-sm" aria-label="Buscar" />
        <select name="status" defaultValue={status ?? ""} className="input max-w-56" aria-label="Status">
          <option value="">Todos</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      {orders.length === 0 ? <EmptyState icon="cart" title="Nenhum pedido encontrado" /> : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Criado</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/pedidos/${o.id}`} className="font-medium hover:text-sun">{o.code}</Link></td>
                  <td className="text-xs">{o.customerName}<br /><span className="text-muted">{o.customerEmail}</span></td>
                  <td className="max-w-64 text-xs">{o.items.map((i) => i.titleSnapshot).join(", ")}</td>
                  <td>{formatBRL(o.totalCents)}</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td className="whitespace-nowrap text-xs">{formatDate(o.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
