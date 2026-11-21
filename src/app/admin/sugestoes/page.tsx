import { prisma } from "@/lib/db";
import { formatDate, safeUrl } from "@/lib/misc";
import { EmptyState } from "@/components/ui";
import { reviewSuggestionAction } from "../actions/content";

export default async function Suggestions() {
  const list = await prisma.suggestion.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { user: { select: { name: true, email: true } } } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Sugestões de conteúdo</h1>
      <p className="text-sm text-muted">Sugestões nunca são publicadas automaticamente. Para publicar, cadastre o produto manualmente depois de verificar autoria e licença.</p>
      {list.length === 0 ? <EmptyState title="Nenhuma sugestão recebida" /> : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="card p-4 text-sm">
              <p className="font-semibold">{s.title} <span className="chip ml-1">{s.status}</span></p>
              <p className="text-xs text-muted">{s.user.name} ({s.user.email}) · {formatDate(s.createdAt, true)} · {s.isOwner ? "declarou ser autor/ter permissão" : "não declarou autoria"}</p>
              {safeUrl(s.url) && <a href={safeUrl(s.url)!} target="_blank" rel="noopener noreferrer nofollow" className="text-sun underline">{s.url}</a>}
              <p className="mt-2 whitespace-pre-line">{s.description}</p>
              <form action={reviewSuggestionAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={s.id} />
                <input name="adminNotes" defaultValue={s.adminNotes ?? ""} placeholder="Anotações" className="input max-w-sm" aria-label="Anotações" />
                <select name="status" defaultValue={s.status} className="input max-w-40" aria-label="Status">
                  <option value="PENDING">Pendente</option>
                  <option value="APPROVED">Aprovada</option>
                  <option value="REJECTED">Recusada</option>
                </select>
                <button className="btn-secondary">Salvar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
