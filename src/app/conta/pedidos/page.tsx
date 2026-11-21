import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { expireStaleOrders } from "@/lib/payments";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/misc";
import { EmptyState, OrderStatusBadge } from "@/components/ui";

export const metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  const user = await requireUser("/conta/pedidos");
  await expireStaleOrders();
  const orders = await prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 100 });
  if (orders.length === 0) return <EmptyState icon="cart" title="Você ainda não fez pedidos" action={<Link href="/loja" className="btn-primary">Ver a loja</Link>} />;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <Link href={`/conta/pedidos/${o.code}`} className="font-semibold hover:text-sun">Pedido {o.code}</Link>
            <p className="text-xs text-muted">{formatDate(o.createdAt, true)} · {o.items.map((i) => i.titleSnapshot).join(", ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold">{formatBRL(o.totalCents)}</span>
            <OrderStatusBadge status={o.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
