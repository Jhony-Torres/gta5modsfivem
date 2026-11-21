import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { moderateAction } from "../actions/content";

export default async function Moderation() {
  const [reviews, comments] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, email: true } }, product: { select: { title: true, slug: true } } } }),
    prisma.comment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } }, product: { select: { title: true, slug: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Comentários e avaliações</h1>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Avaliações ({reviews.length})</h2>
        {reviews.length === 0 ? <p className="text-sm text-muted">Nenhuma avaliação.</p> : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <Item key={r.id} kind="review" id={r.id} hidden={r.status === "HIDDEN"} head={`${r.rating}★ · ${r.user.name} (${r.user.email})`} product={r.product} date={r.createdAt} body={r.body} />
            ))}
          </ul>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Comentários ({comments.length})</h2>
        {comments.length === 0 ? <p className="text-sm text-muted">Nenhum comentário.</p> : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <Item key={c.id} kind="comment" id={c.id} hidden={c.status === "HIDDEN"} head={`${c.user.name} (${c.user.email})`} product={c.product} date={c.createdAt} body={c.body} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ kind, id, hidden, head, product, date, body }: { kind: string; id: string; hidden: boolean; head: string; product: { title: string; slug: string }; date: Date; body: string | null }) {
  return (
    <li className={`rounded-xl border border-line p-3 text-sm ${hidden ? "opacity-60" : ""}`}>
      <p>
        <strong>{head}</strong> em <Link href={`/mods/${product.slug}`} className="text-sun underline">{product.title}</Link>{" "}
        <span className="text-xs text-muted">· {formatDate(date, true)}</span> {hidden && <span className="chip text-warn">oculto</span>}
      </p>
      {body && <p className="mt-1 whitespace-pre-line text-text/90">{body}</p>}
      <div className="mt-2 flex gap-2">
        {[hidden ? ["show", "Mostrar"] : ["hide", "Ocultar"], ["delete", "Remover"]].map(([op, label]) => (
          <form key={op} action={moderateAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value={op} />
            <button className={op === "delete" ? "btn-danger px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}>{label}</button>
          </form>
        ))}
      </div>
    </li>
  );
}
