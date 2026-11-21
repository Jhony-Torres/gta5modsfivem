import type { ServerFeature } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Thumb } from "@/components/ui";
import { addMediaAction, deleteEntityAction, saveFeatureAction } from "../actions/content";
import { DeleteButton } from "../shared";

const KINDS = [["ATIVIDADE", "Atividade"], ["PROFISSAO", "Profissão"], ["LOCAL", "Local"], ["SISTEMA", "Sistema"]];

export default async function AdminServer() {
  const [features, media] = await Promise.all([
    prisma.serverFeature.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    prisma.serverMedia.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Servidor Palmas TO</h1>
      <p className="text-sm text-muted">
        Texto de apresentação, endereço de conexão e status ficam em <Link href="/admin/configuracoes" className="text-sun underline">Configurações</Link>. “Como
        jogar” e “Regras” ficam em <Link href="/admin/paginas" className="text-sun underline">Páginas</Link>. Cadastre aqui apenas o que realmente existe na cidade.
      </p>

      <section className="space-y-3">
        <h2 className="section-title">Atividades, profissões, locais e sistemas</h2>
        <details className="card p-5" open={features.length === 0}>
          <summary className="cursor-pointer font-semibold">+ Novo item</summary>
          <div className="mt-4"><FeatureForm /></div>
        </details>
        {features.map((f) => (
          <details key={f.id} className="card p-5">
            <summary className="cursor-pointer"><span className="font-medium">{f.title}</span> <span className="text-xs text-muted">· {f.kind}{f.published ? "" : " · oculto"}</span></summary>
            <div className="mt-4 space-y-3"><FeatureForm f={f} /><DeleteButton action={deleteEntityAction} kind="feature" id={f.id} /></div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Galeria (imagens e vídeos)</h2>
        <div className="card p-5">
          <ActionForm action={addMediaAction} resetOnSuccess className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo" name="m-type"><select id="m-type" name="type" className="input"><option value="IMAGE">Imagem (enviar arquivo)</option><option value="VIDEO">Vídeo (link do YouTube)</option></select></Field>
            <Field label="Legenda" name="m-cap"><input id="m-cap" name="caption" className="input" /></Field>
            <Field label="Arquivo de imagem" name="m-file"><input id="m-file" name="file" type="file" accept="image/*" className="input" /></Field>
            <Field label="Link do vídeo" name="m-url"><input id="m-url" name="url" type="url" className="input" /></Field>
            <Field label="Ordem" name="m-ord"><input id="m-ord" name="sortOrder" type="number" defaultValue={0} className="input" /></Field>
            <div className="self-end"><SubmitButton>Adicionar</SubmitButton></div>
          </ActionForm>
        </div>
        {media.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {media.map((m) => (
              <li key={m.id} className="card overflow-hidden">
                {m.type === "IMAGE" ? <Thumb src={m.url} alt="" className="aspect-video" sizes="200px" /> : <div className="flex aspect-video items-center justify-center p-2 text-center text-xs text-muted">Vídeo: {m.url}</div>}
                <div className="space-y-2 p-2 text-xs"><p>{m.caption}</p><DeleteButton action={deleteEntityAction} kind="media" id={m.id} label="Remover" /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FeatureForm({ f }: { f?: ServerFeature }) {
  const k = f?.id ?? "new";
  return (
    <ActionForm action={saveFeatureAction} resetOnSuccess={!f}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tipo" name={`k-${k}`}><select id={`k-${k}`} name="kind" defaultValue={f?.kind ?? "ATIVIDADE"} className="input">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Título *" name={`t-${k}`}><input id={`t-${k}`} name="title" required defaultValue={f?.title} className="input" /></Field>
        <Field label="Ordem" name={`o-${k}`}><input id={`o-${k}`} name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} className="input" /></Field>
      </div>
      <Field label="Descrição (Markdown)" name={`d-${k}`}><textarea id={`d-${k}`} name="description" rows={3} defaultValue={f?.description ?? ""} className="input" /></Field>
      <Field label="Imagem" name={`i-${k}`}><input id={`i-${k}`} name="image" type="file" accept="image/*" className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={f?.published ?? true} /> Publicado</label>
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );
}
