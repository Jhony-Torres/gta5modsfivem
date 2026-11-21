import { prisma } from "@/lib/db";
import { Markdown } from "@/lib/markdown";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Perguntas frequentes" };
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await prisma.faq.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="Perguntas frequentes" subtitle="Dúvidas comuns sobre o servidor, os downloads e as compras." />
      <div className="container-pto mt-8 max-w-3xl">
        {faqs.length === 0 ? (
          <EmptyState icon="help" title="Nenhuma pergunta cadastrada ainda" />
        ) : (
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.id} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 text-sun group-open:hidden">+</span>
                  <span className="mr-2 hidden text-sun group-open:inline">−</span>
                  {f.question}
                </summary>
                <Markdown source={f.answer} className="mt-3 text-sm" />
              </details>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
