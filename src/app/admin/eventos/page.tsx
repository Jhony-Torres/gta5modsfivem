import type { Event } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { deleteEntityAction, saveEventAction } from "../actions/content";
import { DeleteButton, toLocalInput } from "../shared";

export default async function AdminEvents() {
  const events = await prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 200 });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Eventos</h1>
      <p className="text-sm text-muted">Os horários são interpretados no fuso horário configurado no servidor (defina TZ=America/Araguaina na hospedagem).</p>
      <details className="card p-5" open={events.length === 0}>
        <summary className="cursor-pointer font-semibold">+ Novo evento</summary>
        <div className="mt-4"><EventForm /></div>
      </details>
      {events.map((e) => (
        <details key={e.id} className="card p-5">
          <summary className="cursor-pointer"><span className="font-medium">{e.title}</span> <span className="text-xs text-muted">· {formatDate(e.startsAt, true)} · {e.published ? "publicado" : "oculto"}</span></summary>
          <div className="mt-4 space-y-3"><EventForm e={e} /><DeleteButton action={deleteEntityAction} kind="event" id={e.id} /></div>
        </details>
      ))}
    </div>
  );
}

function EventForm({ e }: { e?: Event }) {
  const k = e?.id ?? "new";
  return (
    <ActionForm action={saveEventAction} resetOnSuccess={!e}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título *" name={`t-${k}`}><input id={`t-${k}`} name="title" required defaultValue={e?.title} className="input" /></Field>
        <Field label="Local" name={`l-${k}`}><input id={`l-${k}`} name="location" defaultValue={e?.location ?? ""} className="input" /></Field>
        <Field label="Início *" name={`s-${k}`}><input id={`s-${k}`} name="startsAt" type="datetime-local" required defaultValue={toLocalInput(e?.startsAt)} className="input" /></Field>
        <Field label="Fim" name={`f-${k}`}><input id={`f-${k}`} name="endsAt" type="datetime-local" defaultValue={toLocalInput(e?.endsAt)} className="input" /></Field>
      </div>
      <Field label="Descrição (Markdown)" name={`d-${k}`}><textarea id={`d-${k}`} name="description" rows={4} defaultValue={e?.description ?? ""} className="input" /></Field>
      <Field label="Imagem" name={`c-${k}`}><input id={`c-${k}`} name="cover" type="file" accept="image/*" className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={e?.published} /> Publicado</label>
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );
}
