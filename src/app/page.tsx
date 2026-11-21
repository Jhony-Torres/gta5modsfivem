import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { activeCategories, listCards } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/misc";
import { SearchForm } from "@/components/layout";
import { Icon } from "@/components/icons";
import { EmptyState, ProductGrid, Section, Thumb } from "@/components/ui";
import { ServerStatusCard, SocialButtons } from "@/components/server-bits";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSettings();
  const [cats, featured, recent, updated, free, paid, mostDl, mostFav, topRated, posts] = await Promise.all([
    activeCategories(),
    listCards({ featured: true }, [{ featuredOrder: "asc" }, { publishedAt: "desc" }], 8),
    listCards({}, [{ publishedAt: "desc" }], 8),
    // somente itens atualizados depois da publicação
    listCards({ contentUpdatedAt: { gt: prisma.product.fields.publishedAt } }, [{ contentUpdatedAt: "desc" }], 4),
    listCards({ pricingType: "FREE" }, [{ publishedAt: "desc" }], 4),
    listCards({ pricingType: "PAID" }, [{ publishedAt: "desc" }], 4),
    listCards({ downloadCount: { gt: 0 } }, [{ downloadCount: "desc" }], 4),
    listCards({ favoriteCount: { gt: 0 } }, [{ favoriteCount: "desc" }], 4),
    listCards({ ratingCount: { gt: 0 } }, [{ ratingAvg: "desc" }, { ratingCount: "desc" }], 4),
    prisma.post.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const heroImg = s["home.heroImage"];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line/60 hero-glow">
        {heroImg && (
          <div className="absolute inset-0 opacity-25">
            <Image src={heroImg} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
          </div>
        )}
        <div className="container-pto relative py-14 sm:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-river">Roleplay · FiveM · Tocantins</p>
          <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {s["home.heroTitle"]}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{s["home.heroText"]}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/servidor" className="btn-primary px-5 py-3 text-base">
              Conhecer o servidor
            </Link>
            <Link href="/mods" className="btn-secondary px-5 py-3 text-base">
              Explorar mods e scripts
            </Link>
            <SocialButtons />
          </div>
          <div className="mt-9 max-w-2xl">
            <SearchForm big />
          </div>
        </div>
      </section>

      {/* DUAS ÁREAS */}
      <section className="container-pto -mt-px grid gap-4 pt-10 md:grid-cols-[1fr_1fr_300px]" aria-label="Áreas do site">
        <Link href="/servidor" className="card group p-6 transition-colors hover:border-sun/50">
          <Icon name="users" className="h-7 w-7 text-sun" />
          <h2 className="mt-3 font-display text-xl font-bold group-hover:text-sun">Servidor Palmas TO</h2>
          <p className="mt-1 text-sm text-muted">{s["home.serverCardText"]}</p>
          <span className="mt-4 inline-flex text-sm font-medium text-sun">Como jogar, regras e novidades →</span>
        </Link>
        <Link href="/mods" className="card group p-6 transition-colors hover:border-river/50">
          <Icon name="code" className="h-7 w-7 text-river" />
          <h2 className="mt-3 font-display text-xl font-bold group-hover:text-river">Mods, scripts e recursos</h2>
          <p className="mt-1 text-sm text-muted">{s["home.modsCardText"]}</p>
          <span className="mt-4 inline-flex text-sm font-medium text-river">Downloads gratuitos e loja →</span>
        </Link>
        <ServerStatusCard />
      </section>

      {/* CATEGORIAS */}
      <Section title="Categorias" href="/mods" linkLabel="Ver catálogo" id="h-cat">
        {cats.length === 0 ? (
          <EmptyState title="Categorias ainda não cadastradas" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cats.map((c) => (
              <li key={c.id}>
                <Link href={`/mods?categoria=${c.slug}`} className="card group relative flex h-full items-center gap-3 overflow-hidden p-3.5 hover:border-sun/50">
                  {c.imageUrl ? (
                    <Thumb src={c.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg" sizes="40px" />
                  ) : (
                    <span className="rounded-lg bg-surface-3 p-2 text-sun"><Icon name={c.icon || "box"} className="h-5 w-5" /></span>
                  )}
                  <span className="text-sm font-medium group-hover:text-sun">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {featured.length > 0 && (
        <Section title="Em destaque" id="h-dest">
          <ProductGrid items={featured} />
        </Section>
      )}

      <Section title="Arquivos recentes" href="/mods?ordem=recentes" id="h-rec">
        <ProductGrid items={recent} empty={<EmptyState title="Nenhum arquivo publicado ainda" text="Os primeiros mods e scripts aparecerão aqui assim que forem publicados." />} />
      </Section>

      {updated.length > 0 && (
        <Section title="Atualizados recentemente" href="/mods?ordem=atualizados" id="h-upd">
          <ProductGrid items={updated} />
        </Section>
      )}

      <div className="grid gap-0 xl:grid-cols-2">
        <Section title="Downloads gratuitos" href="/gratis" id="h-free">
          <MiniList items={free} empty="Nenhum download gratuito publicado ainda." />
        </Section>
        <Section title="Produtos da loja" href="/loja" id="h-paid">
          <MiniList items={paid} empty="Nenhum produto pago publicado ainda." />
        </Section>
      </div>

      <section className="container-pto mt-14" aria-labelledby="h-rank">
        <h2 id="h-rank" className="section-title mb-5">Rankings</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Ranking title="Mais baixados" href="/mods?ordem=baixados" items={mostDl} metric={(p) => `${p.downloadCount.toLocaleString("pt-BR")} downloads`} />
          <Ranking title="Mais curtidos" href="/mods?ordem=curtidos" items={mostFav} metric={(p) => `${p.favoriteCount} favoritos`} />
          <Ranking title="Mais bem avaliados" href="/mods?ordem=avaliados" items={topRated} metric={(p) => `${p.ratingAvg.toFixed(1).replace(".", ",")} ★ (${p.ratingCount})`} />
        </div>
      </section>

      <Section title="Novidades da comunidade" href="/noticias" id="h-news">
        {posts.length === 0 ? (
          <EmptyState icon="news" title="Nenhuma novidade publicada ainda" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/noticias/${p.slug}`} className="card group overflow-hidden hover:border-sun/50">
                <Thumb src={p.coverImage} alt="" className="aspect-video" />
                <div className="p-4">
                  <p className="text-xs text-muted">{formatDate(p.publishedAt)}</p>
                  <h3 className="mt-1 font-semibold group-hover:text-sun">{p.title}</h3>
                  {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

type C = Awaited<ReturnType<typeof listCards>>[number];

function MiniList({ items, empty }: { items: C[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return <ProductGrid items={items} />;
}

function Ranking({ title, href, items, metric }: { title: string; href: string; items: C[]; metric: (p: C) => string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {items.length > 0 && <Link href={href} className="text-xs text-sun hover:underline">Ver mais</Link>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Ainda não há dados suficientes para este ranking.</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
              <Link href={`/mods/${p.slug}`} className="min-w-0 flex-1 truncate hover:text-sun">{p.title}</Link>
              <span className="shrink-0 text-xs text-muted">{metric(p)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
