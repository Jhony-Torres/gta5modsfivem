import { prisma } from "@/lib/db";
import { Markdown } from "@/lib/markdown";
import { formatDate } from "@/lib/misc";
import { EmptyState, PageHeader, Thumb } from "@/components/ui";

export const metadata = { title: "Eventos" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const now = new Date(Date.now() - 864e5);
  const [upcoming, past] = await Promise.all([
    prisma.event.findMany({ where: { published: true, startsAt: { gte: now } }, orderBy: { startsAt: "asc" } }),
    prisma.event.findMany({ where: { published: true, startsAt: { lt: now } }, orderBy: { startsAt: "desc" }, take: 12 }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Comunidade" title="Eventos" subtitle="Eventos da cidade Palmas TO e da comunidade." />
      <div className="container-pto mt-8 space-y-10">
        <section>
          <h2 className="section-title mb-4">Próximos eventos</h2>
          {upcoming.length === 0 ? <EmptyState icon="calendar" title="Nenhum evento agendado no momento" /> : <EventList items={upcoming} />}
        </section>
        {past.length > 0 && (
          <section>
            <h2 className="section-title mb-4">Eventos anteriores</h2>
            <EventList items={past} />
          </section>
        )}
      </div>
    </>
  );
}

function EventList({ items }: { items: Awaited<ReturnType<typeof prisma.event.findMany>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((e) => (
        <article key={e.id} className="card overflow-hidden">
          {e.coverImage && <Thumb src={e.coverImage} alt="" className="aspect-[21/9]" />}
          <div className="p-5">
            <p className="text-sm font-medium text-sun">{formatDate(e.startsAt, true)}{e.endsAt ? ` até ${formatDate(e.endsAt, true)}` : ""}</p>
            <h3 className="mt-1 text-lg font-semibold">{e.title}</h3>
            {e.location && <p className="text-sm text-muted">Local: {e.location}</p>}
            {e.description && <Markdown source={e.description} className="mt-2 text-sm" />}
          </div>
        </article>
      ))}
    </div>
  );
}
