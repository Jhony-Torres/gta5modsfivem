import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, safeUrl } from "@/lib/misc";
import { EmptyState, Thumb } from "@/components/ui";
import { DownloadButton } from "@/components/product-client";

export const metadata = { title: "Meus produtos" };

export default async function MyProducts() {
  const user = await requireUser("/conta/produtos");
  const ents = await prisma.entitlement.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { code: true } },
      product: { include: { versions: { where: { isCurrent: true }, take: 1 } } },
    },
  });
  if (ents.length === 0) {
    return <EmptyState icon="box" title="Nenhum produto comprado ainda" text="Depois que um pagamento for confirmado, os produtos aparecem aqui." action={<Link href="/loja" className="btn-primary">Ver a loja</Link>} />;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {ents.map(({ product: p, order, createdAt }) => (
        <li key={p.id} className="card overflow-hidden">
          <Thumb src={p.coverImage} alt="" className="aspect-[21/9]" />
          <div className="space-y-3 p-4">
            <div>
              <Link href={`/mods/${p.slug}`} className="font-semibold hover:text-sun">{p.title}</Link>
              <p className="text-xs text-muted">
                Liberado em {formatDate(createdAt)}{order ? ` · pedido ${order.code}` : ""}{p.versions[0] ? ` · versão ${p.versions[0].version}` : ""}
              </p>
            </div>
            {p.deliveryType === "SITE_FILE" ? (
              <DownloadButton productId={p.id} label="Baixar" />
            ) : p.deliveryType === "EXTERNAL" ? (
              <p className="text-sm text-muted">
                Entrega pela plataforma externa.{" "}
                {safeUrl(p.externalUrl) && <a className="text-sun underline" href={safeUrl(p.externalUrl)!} target="_blank" rel="noopener noreferrer">Acessar</a>}
              </p>
            ) : (
              <p className="text-sm text-muted">Entrega manual: fale com a equipe no Discord ou pela página de contato informando o código do pedido.</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
