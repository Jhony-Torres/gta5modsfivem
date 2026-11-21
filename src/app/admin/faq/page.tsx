import type { Faq } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { deleteEntityAction, saveFaqAction } from "../actions/content";
import { DeleteButton } from "../shared";

export default async function AdminFaq() {
  const faqs = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Perguntas frequentes</h1>
      <details className="card p-5" open={faqs.length === 0}>
        <summary className="cursor-pointer font-semibold">+ Nova pergunta</summary>
        <div className="mt-4"><FaqForm /></div>
      </details>
      {faqs.map((f) => (
        <details key={f.id} className="card p-5">
          <summary className="cursor-pointer"><span className="font-medium">{f.question}</span> <span className="text-xs text-muted">· ordem {f.sortOrder}{f.published ? "" : " · oculta"}</span></summary>
          <div className="mt-4 space-y-3"><FaqForm f={f} /><DeleteButton action={deleteEntityAction} kind="faq" id={f.id} /></div>
        </details>
      ))}
    </div>
  );
}

function FaqForm({ f }: { f?: Faq }) {
  const k = f?.id ?? "new";
  return (
    <ActionForm action={saveFaqAction} resetOnSuccess={!f}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Pergunta *" name={`q-${k}`}><input id={`q-${k}`} name="question" required defaultValue={f?.question} className="input" /></Field>
      <Field label="Resposta * (Markdown)" name={`a-${k}`}><textarea id={`a-${k}`} name="answer" required rows={4} defaultValue={f?.answer} className="input" /></Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Ordem" name={`o-${k}`}><input id={`o-${k}`} name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} className="input w-28" /></Field>
        <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="published" defaultChecked={f?.published ?? true} /> Publicada</label>
      </div>
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );
}
