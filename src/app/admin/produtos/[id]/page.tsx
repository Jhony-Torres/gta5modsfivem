import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/misc";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { ProductForm } from "../product-form";
import { VersionUploader } from "../version-uploader";
import { addImagesAction, deleteProductAction, deleteVersionAction, recountStatsAction, removeImageAction, setCurrentVersionAction } from "../../actions/products";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const { id } = await params;
  const { criado } = await searchParams;
  const [p, categories, sales] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, images: { orderBy: { sortOrder: "asc" } }, versions: { orderBy: { createdAt: "desc" }, include: { file: true, _count: { select: { downloads: true } } } } },
    }),
    prisma.category.findMany({ where: { parentId: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { children: { orderBy: { sortOrder: "asc" } } } }),
    prisma.orderItem.count({ where: { productId: id, order: { status: "PAID" } } }),
  ]);
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{p.title}</h1>
          <p className="text-sm text-muted">{p.downloadCount} downloads · {p.favoriteCount} favoritos · {p.ratingCount} avaliações · {sales} vendas confirmadas</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/mods/${p.slug}`} className="btn-secondary" target="_blank">Ver página</Link>
          <form action={recountStatsAction}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost">Recalcular contadores</button></form>
        </div>
      </div>
      {criado && <Notice tone="ok">Produto criado. Agora adicione imagens e a primeira versão com o arquivo.</Notice>}
      {p.versions.length === 0 && <Notice tone="warn">Nenhuma versão cadastrada: o botão de download/compra não terá arquivo para entregar.</Notice>}

      <ProductForm product={p} categories={categories} />

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Galeria de imagens</h2>
        {p.images.length === 0 ? <p className="text-sm text-muted">Nenhuma imagem na galeria.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {p.images.map((im) => (
              <li key={im.id} className="overflow-hidden rounded-xl border border-line">
                <div className="relative aspect-video"><Image src={im.url} alt={im.alt ?? ""} fill sizes="200px" className="object-cover" /></div>
                <form action={removeImageAction} className="p-2"><input type="hidden" name="id" value={im.id} /><button className="btn-danger w-full py-1.5 text-xs">Remover</button></form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addImagesAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={p.id} />
          <div><label className="label" htmlFor="images">Adicionar imagens</label><input id="images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="input" /></div>
          <div><label className="label" htmlFor="alt">Texto alternativo</label><input id="alt" name="alt" className="input" placeholder="Descrição da imagem" /></div>
          <SubmitButton pendingText="Enviando...">Enviar imagens</SubmitButton>
        </ActionForm>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Versões e arquivos</h2>
        {p.versions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Versão</th><th>Arquivo</th><th>Downloads</th><th>Data</th><th></th></tr></thead>
              <tbody>
                {p.versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.version} {v.isCurrent && <span className="chip ml-1 text-sun">atual</span>}</td>
                    <td className="text-xs">{v.file ? <>{v.file.originalName}<br /><span className="text-muted">{formatBytes(v.file.size)} · sha256 {v.file.sha256.slice(0, 12)}…</span></> : <span className="text-muted">sem arquivo</span>}</td>
                    <td>{v._count.downloads}</td>
                    <td className="whitespace-nowrap">{formatDate(v.createdAt)}</td>
                    <td className="flex gap-1.5">
                      {!v.isCurrent && <form action={setCurrentVersionAction}><input type="hidden" name="id" value={v.id} /><button className="btn-secondary px-2.5 py-1 text-xs">Tornar atual</button></form>}
                      <form action={deleteVersionAction}><input type="hidden" name="id" value={v.id} /><button className="btn-danger px-2.5 py-1 text-xs">Excluir</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-semibold">Nova versão</h3>
          <VersionUploader productId={p.id} />
        </div>
        <p className="text-xs text-muted">Os arquivos não passam por antivírus automaticamente neste servidor. Verifique os arquivos antes de publicar.</p>
      </section>

      <section className="card space-y-3 border-bad/30 p-5">
        <h2 className="font-semibold text-bad">Excluir produto</h2>
        <p className="text-sm text-muted">Se houver pedidos vinculados, o produto será apenas despublicado para preservar o histórico.</p>
        <form action={deleteProductAction}><input type="hidden" name="id" value={p.id} /><button className="btn-danger">Excluir / despublicar</button></form>
      </section>
    </div>
  );
}
