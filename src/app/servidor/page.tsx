import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Markdown } from "@/lib/markdown";
import { formatDate, safeUrl, youtubeEmbed } from "@/lib/misc";
import { EmptyState, PageHeader, Thumb } from "@/components/ui";
import { ConnectButton, ServerStatusCard, SocialButtons } from "@/components/server-bits";

export const metadata = { title: "Nosso servidor", description: "Conheça a cidade de roleplay Palmas TO no FiveM." };
export const dynamic = "force-dynamic";

const KINDS: Record<string, string> = { ATIVIDADE: "Atividades", PROFISSAO: "Profissões", LOCAL: "Locais", SISTEMA: "Sistemas" };

export default async function ServerPage() {
  const s = await getSettings();
  const [features, media, posts, events] = await Promise.all([
    prisma.serverFeature.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    prisma.serverMedia.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.post.findMany({ where: { published: true, type: { in: ["NEWS", "UPDATE"] } }, orderBy: { publishedAt: "desc" }, take: 3 }),
    prisma.event.findMany({ where: { published: true, startsAt: { gte: new Date(Date.now() - 864e5) } }, orderBy: { startsAt: "asc" }, take: 3 }),
  ]);
  const video = youtubeEmbed(s["server.videoUrl"]);
  const groups = Object.entries(KINDS)
    .map(([k, label]) => ({ label, items: features.filter((f) => f.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader eyebrow="Servidor de roleplay" title="Palmas TO" subtitle="Uma cidade de roleplay no FiveM inspirada em Palmas, a capital do Tocantins.">
        <div className="flex flex-wrap items-center gap-3">
          <ConnectButton />
          <Link href="/como-jogar" className="btn-secondary">Como jogar</Link>
          <Link href="/regras" className="btn-secondary">Regras</Link>
          <SocialButtons />
        </div>
      </PageHeader>

      <div className="container-pto mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-10">
          {s["server.heroImage"] && (
            <div className="relative aspect-[21/9] overflow-hidden rounded-2xl border border-line">
              <Image src={s["server.heroImage"]} alt="Cidade Palmas TO" fill priority sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" />
            </div>
          )}
          <section aria-labelledby="sobre">
            <h2 id="sobre" className="section-title mb-4">Sobre o servidor</h2>
            {s["server.intro"] ? (
              <Markdown source={s["server.intro"]} />
            ) : (
              <EmptyState title="Apresentação em preparação" text="A equipe ainda está escrevendo a apresentação da cidade. Acompanhe as novidades no Discord." />
            )}
          </section>

          {video && (
            <section aria-labelledby="video-servidor">
              <h2 id="video-servidor" className="section-title mb-4">Vídeo</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-line">
                <iframe src={video} title="Vídeo do servidor Palmas TO" className="h-full w-full" loading="lazy" allowFullScreen />
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="section-title mb-4">{g.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.items.map((f) => (
                  <div key={f.id} className="card overflow-hidden">
                    {f.imageUrl && <Thumb src={f.imageUrl} alt="" className="aspect-video" />}
                    <div className="p-4">
                      <h3 className="font-semibold">{f.title}</h3>
                      {f.description && <Markdown source={f.description} className="mt-1 text-sm" />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {media.length > 0 && (
            <section aria-labelledby="galeria">
              <h2 id="galeria" className="section-title mb-4">Galeria da cidade</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {media.map((m) => {
                  const emb = m.type === "VIDEO" ? youtubeEmbed(m.url) : null;
                  return (
                    <figure key={m.id} className="card overflow-hidden">
                      {m.type === "VIDEO" ? (
                        emb ? (
                          <div className="aspect-video"><iframe src={emb} title={m.caption ?? "Vídeo"} className="h-full w-full" loading="lazy" allowFullScreen /></div>
                        ) : safeUrl(m.url) ? (
                          <a href={safeUrl(m.url)!} target="_blank" rel="noopener noreferrer" className="flex aspect-video items-center justify-center text-sun underline">Assistir vídeo</a>
                        ) : null
                      ) : (
                        <Thumb src={m.url} alt={m.caption ?? ""} className="aspect-video" />
                      )}
                      {m.caption && <figcaption className="p-3 text-sm text-muted">{m.caption}</figcaption>}
                    </figure>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <ServerStatusCard />
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Próximos eventos</h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted">Nenhum evento agendado.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {events.map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted">{formatDate(e.startsAt, true)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/eventos" className="mt-3 inline-block text-sm text-sun hover:underline">Todos os eventos →</Link>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Novidades</h2>
            {posts.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma novidade publicada.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/noticias/${p.slug}`} className="font-medium hover:text-sun">{p.title}</Link>
                    <p className="text-xs text-muted">{formatDate(p.publishedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card space-y-2 p-5 text-sm">
            <Link href="/faq" className="block hover:text-sun">Perguntas frequentes →</Link>
            <Link href="/contato" className="block hover:text-sun">Contato e suporte →</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
