import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { ActionForm, SubmitButton } from "@/components/forms";
import { savePageAction } from "../actions/content";

const PAGES: [string, string, string][] = [
  ["como-jogar", "Como jogar", "/como-jogar"],
  ["regras", "Regras do servidor", "/regras"],
  ["contato", "Contato e suporte", "/contato"],
  ["legal-termos", "Termos de uso", "/legal/termos"],
  ["legal-privacidade", "Política de privacidade", "/legal/privacidade"],
  ["legal-reembolso", "Política de compra e reembolso", "/legal/reembolso"],
  ["legal-licenca", "Licença e condições de uso dos produtos", "/legal/licenca"],
  ["legal-remocao", "Direitos autorais e remoção", "/legal/remocao"],
];

export default async function AdminPages() {
  const pages = await prisma.page.findMany();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Páginas e textos</h1>
      <p className="text-sm text-muted">
        Use Markdown simples. Marcadores como <code>{"{{contact.email}}"}</code> e <code>{"{{legal.entityName}}"}</code> são substituídos pelos valores das
        configurações; se estiverem vazios aparecem como <strong>[pendente]</strong>. Marque “revisada” somente depois de conferir o texto (de preferência com
        apoio jurídico, no caso das políticas).
      </p>
      {PAGES.map(([slug, label, href]) => {
        const p = pages.find((x) => x.slug === slug);
        return (
          <details key={slug} className="card p-5">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{label}</span>
              <a href={href} target="_blank" className="text-xs text-sun underline">{href}</a>
              {!p ? <span className="chip text-warn">não criada</span> : p.needsReview ? <span className="chip text-warn">precisa de revisão</span> : <span className="chip text-ok">revisada</span>}
              {p && <span className="text-xs text-muted">atualizada {formatDate(p.updatedAt, true)}</span>}
            </summary>
            <ActionForm action={savePageAction} className="mt-4 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <label className="label" htmlFor={`t-${slug}`}>Título</label>
              <input id={`t-${slug}`} name="title" defaultValue={p?.title ?? label} required className="input" />
              <label className="label" htmlFor={`b-${slug}`}>Conteúdo</label>
              <textarea id={`b-${slug}`} name="body" rows={16} defaultValue={p?.body ?? ""} className="input font-mono text-xs" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reviewed" defaultChecked={p ? !p.needsReview : false} /> Conteúdo revisado e pronto para publicação</label>
              <SubmitButton>Salvar página</SubmitButton>
            </ActionForm>
          </details>
        );
      })}
    </div>
  );
}
