import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/misc";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { userAdminAction } from "../actions/content";
import { adminEntitlementAction } from "../actions/orders";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const me = await getCurrentUser();
  const [users, products] = await Promise.all([
    prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { _count: { select: { orders: { where: { status: "PAID" } }, entitlements: { where: { revokedAt: null } }, downloads: true } } },
    }),
    prisma.product.findMany({ where: { pricingType: "PAID" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Usuários</h1>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Nome ou e-mail" className="input max-w-sm" aria-label="Buscar" /><button className="btn-secondary">Buscar</button></form>
      <div className="card overflow-x-auto">
        <table className="admin-table">
          <thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th><th>Compras</th><th>Produtos</th><th>Downloads</th><th>Desde</th><th>Ações</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<br /><span className="text-xs text-muted">{u.email}</span></td>
                <td>{u.role === "ADMIN" ? <span className="text-sun">Admin</span> : "Usuário"}</td>
                <td>{u.status === "ACTIVE" ? "Ativo" : <span className="text-bad">Bloqueado</span>}</td>
                <td>{u._count.orders}</td>
                <td>{u._count.entitlements}</td>
                <td>{u._count.downloads}</td>
                <td className="whitespace-nowrap text-xs">{formatDate(u.createdAt)}</td>
                <td>
                  {u.id !== me?.id && (
                    <div className="flex flex-wrap gap-1">
                      <Op id={u.id} op={u.status === "ACTIVE" ? "block" : "unblock"} label={u.status === "ACTIVE" ? "Bloquear" : "Desbloquear"} />
                      <Op id={u.id} op={u.role === "ADMIN" ? "removeAdmin" : "makeAdmin"} label={u.role === "ADMIN" ? "Remover admin" : "Tornar admin"} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card max-w-xl p-5">
        <h2 className="font-semibold">Conceder ou revogar acesso a produto</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Para entregas manuais, cortesias ou correções. Toda ação fica no registro.</p>
        <ActionForm action={adminEntitlementAction}>
          <Field label="E-mail do usuário" name="ent-email"><input id="ent-email" name="email" type="email" required className="input" /></Field>
          <Field label="Produto" name="ent-product">
            <select id="ent-product" name="productId" required className="input">{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          </Field>
          <Field label="Ação" name="ent-op"><select id="ent-op" name="op" className="input"><option value="grant">Conceder</option><option value="revoke">Revogar</option></select></Field>
          <SubmitButton>Aplicar</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

function Op({ id, op, label }: { id: string; op: string; label: string }) {
  return (
    <form action={userAdminAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className="btn-secondary px-2 py-1 text-xs">{label}</button>
    </form>
  );
}
