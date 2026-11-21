import type { Post } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { deleteEntityAction, savePostAction } from "../actions/content";
import { DeleteButton } from "../shared";

export default async function AdminPosts() {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Notícias, atualizações e tutoriais</h1>
      <details className="card p-5" open={posts.length === 0}>
        <summary className="cursor-pointer font-semibold">+ Nova publicação</summary>
        <div className="mt-4"><PostForm /></div>
      </details>
      {posts.map((p) => (
        <details key={p.id} className="card p-5">
          <summary className="cursor-pointer">
            <span className="font-medium">{p.title}</span>{" "}
            <span className="text-xs text-muted">· {p.type} · {p.published ? `publicado ${formatDate(p.publishedAt)}` : "rascunho"}</span>
          </summary>
          <div className="mt-4 space-y-3">
            <PostForm p={p} />
            <DeleteButton action={deleteEntityAction} kind="post" id={p.id} />
          </div>
        </details>
      ))}
    </div>
  );
}

function PostForm({ p }: { p?: Post }) {
  const k = p?.id ?? "new";
  return (
    <ActionForm action={savePostAction} resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Título *" name={`t-${k}`}><input id={`t-${k}`} name="title" required defaultValue={p?.title} className="input" /></Field>
        <Field label="Slug" name={`s-${k}`}><input id={`s-${k}`} name="slug" defaultValue={p?.slug} className="input" /></Field>
        <Field label="Tipo" name={`ty-${k}`}>
          <select id={`ty-${k}`} name="type" defaultValue={p?.type ?? "NEWS"} className="input">
            <option value="NEWS">Notícia</option><option value="UPDATE">Atualização</option><option value="TUTORIAL">Tutorial</option>
          </select>
        </Field>
      </div>
      <Field label="Resumo" name={`e-${k}`}><input id={`e-${k}`} name="excerpt" maxLength={400} defaultValue={p?.excerpt ?? ""} className="input" /></Field>
      <Field label="Conteúdo (Markdown)" name={`b-${k}`}><textarea id={`b-${k}`} name="body" rows={10} defaultValue={p?.body} className="input font-mono text-xs" /></Field>
      <Field label="Capa" name={`c-${k}`}><input id={`c-${k}`} name="cover" type="file" accept="image/*" className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={p?.published} /> Publicado</label>
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );
}
