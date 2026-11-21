import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Meus downloads" };

export default async function MyDownloads() {
  const user = await requireUser("/conta/downloads");
  const rows = await prisma.download.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { product: { select: { title: true, slug: true } }, version: { select: { version: true } } },
  });
  if (rows.length === 0) return <EmptyState icon="download" title="Nenhum download registrado" text="Os arquivos que você baixar com a conta conectada aparecem aqui." />;
  return (
    <div className="card overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr><th>Arquivo</th><th>Versão</th><th>Data</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/mods/${r.product.slug}`} className="hover:text-sun">{r.product.title}</Link></td>
              <td>{r.version?.version ?? "—"}</td>
              <td>{formatDate(r.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
