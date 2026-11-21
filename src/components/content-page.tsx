import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Markdown } from "@/lib/markdown";
import { formatDate } from "@/lib/misc";
import { getSettings } from "@/lib/settings";
import { EmptyState, Notice, PageHeader } from "./ui";

/** Substitui marcadores {{chave}} pelos valores do painel. Campos vazios aparecem como pendentes. */
export async function fillPlaceholders(text: string) {
  const s = await getSettings();
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, k) => {
    const v = (s as Record<string, string>)[k];
    return v ? v : `**[pendente: ${k}]**`;
  });
}

export async function ContentPage({ slug, eyebrow, fallbackTitle, children }: { slug: string; eyebrow?: string; fallbackTitle: string; children?: React.ReactNode }) {
  const page = await prisma.page.findUnique({ where: { slug } });
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={page?.title ?? fallbackTitle} subtitle={page ? `Atualizado em ${formatDate(page.updatedAt)}` : undefined} />
      <div className="container-pto mt-8 max-w-3xl space-y-6">
        {page?.needsReview && user?.role === "ADMIN" && (
          <Notice tone="warn" title="Somente administradores veem este aviso">
            Esta página é um modelo e precisa ser revisada (e marcada como revisada no painel) antes da publicação do site.
          </Notice>
        )}
        {page ? (
          <div className="card p-6 sm:p-8">
            <Markdown source={await fillPlaceholders(page.body)} />
          </div>
        ) : (
          <EmptyState title="Conteúdo em preparação" text="Esta página ainda não foi preenchida pela equipe." />
        )}
        {children}
      </div>
    </>
  );
}
