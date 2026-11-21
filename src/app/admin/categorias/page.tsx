import type { Category } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { CATEGORY_ICONS, Icon } from "@/components/icons";
import { deleteCategoryAction, saveCategoryAction } from "../actions/products";

export default async function AdminCategories() {
  const cats = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }, _count: { select: { products: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Categorias</h1>
      <details className="card p-5" open={cats.length === 0}>
        <summary className="cursor-pointer font-semibold">+ Nova categoria ou subcategoria</summary>
        <div className="mt-4"><CatForm parents={cats} /></div>
      </details>
      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="card p-4">
            <CatRow c={c} count={c._count.products} parents={cats} />
            {c.children.length > 0 && (
              <ul className="mt-3 space-y-2 border-l border-line pl-4">
                {c.children.map((s) => <li key={s.id}><CatRow c={s} count={s._count.products} parents={cats} /></li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatRow({ c, count, parents }: { c: Category; count: number; parents: Category[] }) {
  return (
    <details>
      <summary className="flex cursor-pointer items-center gap-3">
        <Icon name={c.icon || "box"} className="h-4 w-4 text-sun" />
        <span className="font-medium">{c.name}</span>
        <span className="text-xs text-muted">/{c.slug} · {count} produto(s) · ordem {c.sortOrder}</span>
        {!c.active && <span className="chip text-warn">desativada</span>}
      </summary>
      <div className="mt-4 space-y-3">
        <CatForm c={c} parents={parents} />
        <form action={deleteCategoryAction}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn-danger text-xs">{count > 0 ? "Desativar (possui produtos)" : "Excluir"}</button>
        </form>
      </div>
    </details>
  );
}

function CatForm({ c, parents }: { c?: Category; parents: Category[] }) {
  const k = c?.id ?? "new";
  return (
    <ActionForm action={saveCategoryAction} resetOnSuccess={!c} className="grid gap-3 md:grid-cols-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Nome *" name={`name-${k}`}><input id={`name-${k}`} name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="Slug" name={`slug-${k}`}><input id={`slug-${k}`} name="slug" defaultValue={c?.slug} className="input" /></Field>
      <Field label="Categoria principal" name={`parent-${k}`} hint="Vazio = categoria principal">
        <select id={`parent-${k}`} name="parentId" defaultValue={c?.parentId ?? ""} className="input">
          <option value="">—</option>
          {parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Ícone" name={`icon-${k}`}>
        <select id={`icon-${k}`} name="icon" defaultValue={c?.icon ?? "box"} className="input">
          {CATEGORY_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="Ordem" name={`order-${k}`}><input id={`order-${k}`} name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" /></Field>
      <Field label="Imagem (opcional)" name={`img-${k}`}><input id={`img-${k}`} name="image" type="file" accept="image/*" className="input" /></Field>
      <div className="md:col-span-3"><Field label="Descrição" name={`desc-${k}`}><textarea id={`desc-${k}`} name="description" rows={2} defaultValue={c?.description ?? ""} className="input" /></Field></div>
      <div className="flex flex-wrap items-center gap-4 md:col-span-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Ativa</label>
        {c?.imageUrl && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeImage" /> Remover imagem</label>}
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </ActionForm>
  );
}
