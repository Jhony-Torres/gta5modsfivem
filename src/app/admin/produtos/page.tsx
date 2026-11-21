import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/misc";
import { effectivePriceCents } from "@/lib/pricing";
import { EmptyState } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", UNPUBLISHED: "Despublicado" };
const CHECKOUT_LABEL: Record<string, string> = { NONE: "Download", INFINITEPAY: "InfinitePay", TEBEX: "Tebex", CFX_MARKETPLACE: "Cfx Marketplace", EXTERNAL_LINK: "Link externo" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const products = await prisma.product.findMany({
    where: {
      ...(q ? { title: { contains: q } } : {}),
      ...(status && ["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(status) ? { status: status as "DRAFT" } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { category: true, _count: { select: { versions: true } } },
    take: 300,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Produtos</h1>
        <Link href="/admin/produtos/novo" className="btn-primary">+ Novo produto</Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por título" className="input max-w-xs" aria-label="Buscar" />
        <select name="status" defaultValue={status ?? ""} className="input max-w-48" aria-label="Status">
          <option value="">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="UNPUBLISHED">Despublicado</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      {products.length === 0 ? (
        <EmptyState title="Nenhum produto cadastrado" action={<Link href="/admin/produtos/novo" className="btn-primary">Cadastrar o primeiro</Link>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr><th>Título</th><th>Status</th><th>Preço</th><th>Venda</th><th>Conformidade</th><th>Downloads</th><th>Atualizado</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/produtos/${p.id}`} className="font-medium hover:text-sun">{p.title}</Link>
                    <div className="text-xs text-muted">{p.category?.name ?? "Sem categoria"} · {p._count.versions} versão(ões){p.featured ? " · destaque" : ""}</div>
                  </td>
                  <td>{STATUS_LABEL[p.status]}</td>
                  <td>{p.pricingType === "FREE" ? "Gratuito" : effectivePriceCents(p) == null ? <span className="text-warn">Sem preço</span> : formatBRL(effectivePriceCents(p))}</td>
                  <td>{CHECKOUT_LABEL[p.checkoutType]}</td>
                  <td>{p.pricingType === "PAID" ? (p.complianceStatus === "REVIEWED_OK" ? <span className="text-ok">Revisado</span> : p.complianceStatus === "BLOCKED" ? <span className="text-bad">Bloqueado</span> : <span className="text-warn">Pendente</span>) : "—"}</td>
                  <td>{p.downloadCount}</td>
                  <td className="whitespace-nowrap">{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
