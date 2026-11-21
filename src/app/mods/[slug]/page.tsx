import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cardInclude } from "@/lib/catalog";
import { canBuyOnSite } from "@/lib/pricing";
import { formatBytes, formatDate, safeUrl, youtubeEmbed } from "@/lib/misc";
import { Markdown } from "@/lib/markdown";
import { Icon } from "@/components/icons";
import { Notice, PriceTag, ProductGrid, Stars } from "@/components/ui";
import { AddToCartButton } from "@/components/cart";
import { DownloadButton, FavoriteButton, Gallery, ShareButton } from "@/components/product-client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { addCommentAction, addReviewAction } from "@/app/actions/product";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      versions: { orderBy: { createdAt: "desc" }, include: { file: true } },
      reviews: { where: { status: "VISIBLE" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } }, take: 50 },
      comments: { where: { status: "VISIBLE" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } }, take: 100 },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await prisma.product.findUnique({ where: { slug: (await params).slug }, select: { title: true, shortDescription: true, coverImage: true, status: true } });
  if (!p || p.status !== "PUBLISHED") return { title: "Produto não encontrado" };
  return { title: p.title, description: p.shortDescription ?? undefined, openGraph: p.coverImage ? { images: [p.coverImage] } : undefined };
}

const CHECKOUT_LABEL: Record<string, string> = { TEBEX: "Tebex", CFX_MARKETPLACE: "Cfx Marketplace", EXTERNAL_LINK: "site externo" };

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const p = await load(slug);
  if (!p) notFound();
  const isAdmin = user?.role === "ADMIN";
  if (p.status !== "PUBLISHED" && !isAdmin) notFound();

  const current = p.versions.find((v) => v.isCurrent) ?? p.versions[0] ?? null;
  const [favorite, entitlement, myReview, related] = await Promise.all([
    user ? prisma.favorite.findUnique({ where: { userId_productId: { userId: user.id, productId: p.id } } }) : null,
    user ? prisma.entitlement.findFirst({ where: { userId: user.id, productId: p.id, revokedAt: null } }) : null,
    user ? prisma.review.findUnique({ where: { productId_userId: { productId: p.id, userId: user.id } } }) : null,
    prisma.product.findMany({
      where: { status: "PUBLISHED", id: { not: p.id }, ...(p.categoryId ? { categoryId: p.categoryId } : {}) },
      orderBy: { downloadCount: "desc" },
      take: 4,
      include: cardInclude,
    }),
  ]);
  const owns = Boolean(entitlement);
  const externalUrl = safeUrl(p.externalUrl);
  const isExternal = p.checkoutType === "TEBEX" || p.checkoutType === "CFX_MARKETPLACE" || p.checkoutType === "EXTERNAL_LINK";
  const hasFile = p.versions.some((v) => v.file);
  const buyable = canBuyOnSite(p) && (p.deliveryType !== "SITE_FILE" || hasFile);
  const embed = youtubeEmbed(p.videoUrl);
  const images = [...(p.coverImage ? [{ url: p.coverImage, alt: p.title }] : []), ...p.images.map((i) => ({ url: i.url, alt: i.alt }))];
  const frameworks = p.frameworks?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const canReview = user && (p.pricingType === "PAID" ? owns : true);

  // Bloco de ação principal (download / compra / link externo)
  let action: React.ReactNode;
  if (p.pricingType === "FREE") {
    if (!hasFile && !externalUrl) action = <Notice tone="warn">O arquivo deste item ainda não foi disponibilizado.</Notice>;
    else if (!hasFile && externalUrl)
      action = (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary w-full">
          <Icon name="external" className="h-4 w-4" /> Acessar download externo
        </a>
      );
    else if (p.requireLogin && !user)
      action = (
        <Link href={`/entrar?next=/mods/${p.slug}`} className="btn-primary w-full">
          Entre para baixar
        </Link>
      );
    else action = <DownloadButton productId={p.id} />;
  } else if (owns && p.deliveryType === "SITE_FILE" && hasFile) {
    action = <DownloadButton productId={p.id} label="Baixar meu produto" />;
  } else if (owns) {
    action = <Notice tone="ok">Você possui este produto. {p.deliveryType === "MANUAL" ? "A entrega é feita manualmente pela equipe — veja as instruções em Meus produtos." : "A entrega é feita pela plataforma externa."}</Notice>;
  } else if (isExternal && externalUrl) {
    action = (
      <div className="space-y-2">
        <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
          <Icon name="external" className="h-4 w-4" /> Comprar no {CHECKOUT_LABEL[p.checkoutType]}
        </a>
        <p className="text-xs text-muted">A compra e a entrega deste produto acontecem fora deste site, pela plataforma indicada. Este site não confirma pagamentos feitos lá.</p>
      </div>
    );
  } else if (buyable) {
    action = <AddToCartButton productId={p.id} />;
  } else {
    action = <Notice tone="warn">Este produto ainda não está disponível para compra.</Notice>;
  }

  return (
    <div className="container-pto py-8">
      {p.status !== "PUBLISHED" && (
        <div className="mb-4">
          <Notice tone="warn" title="Pré-visualização do administrador">Este produto não está publicado ({p.status}). Visitantes não conseguem ver esta página.</Notice>
        </div>
      )}
      <nav aria-label="Trilha" className="mb-4 text-sm text-muted">
        <Link href="/mods" className="hover:text-sun">Mods e scripts</Link>
        {p.category?.parent && (
          <> / <Link href={`/mods?categoria=${p.category.parent.slug}`} className="hover:text-sun">{p.category.parent.name}</Link></>
        )}
        {p.category && (
          <> / <Link href={`/mods?categoria=${p.category.slug}`} className="hover:text-sun">{p.category.name}</Link></>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <header>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{p.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              {p.authorName && <span>por <strong className="text-text">{p.authorName}</strong></span>}
              {p.ratingCount > 0 ? <Stars value={p.ratingAvg} count={p.ratingCount} /> : <span>Sem avaliações ainda</span>}
              {current && <span>Versão {current.version}</span>}
            </div>
            {p.shortDescription && <p className="mt-4 text-lg text-muted">{p.shortDescription}</p>}
          </header>

          {images.length > 0 ? <Gallery images={images} title={p.title} /> : null}

          {embed ? (
            <section aria-labelledby="video">
              <h2 id="video" className="section-title mb-3">Vídeo</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-line">
                <iframe src={embed} title={`Vídeo de ${p.title}`} className="h-full w-full" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            </section>
          ) : p.videoUrl && safeUrl(p.videoUrl) ? (
            <a href={safeUrl(p.videoUrl)!} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary">
              <Icon name="play" className="h-4 w-4" /> Assistir vídeo de apresentação
            </a>
          ) : null}

          <Block title="Descrição" id="descricao">
            {p.description ? <Markdown source={p.description} /> : <p className="text-muted">Sem descrição cadastrada.</p>}
          </Block>

          <Block title="Requisitos e dependências" id="requisitos">
            {p.requirements || p.dependencies ? (
              <div className="space-y-4">
                {p.requirements && <Markdown source={p.requirements} />}
                {p.dependencies && (
                  <div>
                    <h3 className="mb-1 font-semibold">Dependências</h3>
                    <Markdown source={p.dependencies} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted">Não informados pelo autor.</p>
            )}
          </Block>

          <Block title="Instalação" id="instalacao">
            {p.installation ? <Markdown source={p.installation} /> : <p className="text-muted">Instruções de instalação não informadas.</p>}
          </Block>

          <Block title="Histórico de versões" id="versoes">
            {p.versions.length === 0 ? (
              <p className="text-muted">Nenhuma versão registrada.</p>
            ) : (
              <ol className="space-y-4">
                {p.versions.map((v) => (
                  <li key={v.id} className="border-l-2 border-line pl-4">
                    <p className="font-semibold">
                      {v.version} {v.isCurrent && <span className="chip ml-2 border-sun/40 text-sun">Atual</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDate(v.createdAt)}{v.file ? ` · ${formatBytes(v.file.size)}` : ""}</p>
                    {v.changelog && <Markdown source={v.changelog} className="mt-2 text-sm" />}
                  </li>
                ))}
              </ol>
            )}
          </Block>

          <Block title="Licença e condições de uso" id="licenca">
            {p.licenseName || p.licenseText ? (
              <div>
                {p.licenseName && <p className="font-semibold">{p.licenseName}</p>}
                <Markdown source={p.licenseText} className="mt-2" />
              </div>
            ) : (
              <p className="text-muted">Licença não informada. Em caso de dúvida, consulte as <Link className="text-sun underline" href="/legal/licenca">condições gerais</Link> ou fale com o suporte.</p>
            )}
            {p.credits && (
              <div className="mt-4">
                <h3 className="mb-1 font-semibold">Créditos</h3>
                <Markdown source={p.credits} />
              </div>
            )}
          </Block>

          <section aria-labelledby="avaliacoes" className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="avaliacoes" className="section-title">Avaliações</h2>
              {p.ratingCount > 0 && (
                <span className="flex items-center gap-2 text-sm">
                  <strong className="text-xl">{p.ratingAvg.toFixed(1).replace(".", ",")}</strong>
                  <Stars value={p.ratingAvg} count={p.ratingCount} />
                </span>
              )}
            </div>
            {p.reviews.length === 0 ? (
              <p className="text-sm text-muted">Ainda não há avaliações.</p>
            ) : (
              <ul className="space-y-4">
                {p.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{r.user.name}</strong>
                      <Stars value={r.rating} />
                      <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.body && <p className="mt-2 whitespace-pre-line text-sm text-text/90">{r.body}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 border-t border-line pt-5">
              {!user ? (
                <p className="text-sm text-muted"><Link className="text-sun underline" href={`/entrar?next=/mods/${p.slug}`}>Entre</Link> para avaliar.</p>
              ) : !canReview ? (
                <p className="text-sm text-muted">Somente quem comprou este produto pode avaliá-lo.</p>
              ) : (
                <ActionForm action={addReviewAction} className="space-y-3">
                  <input type="hidden" name="productId" value={p.id} />
                  <fieldset>
                    <legend className="label">{myReview ? "Atualizar sua avaliação" : "Sua nota"}</legend>
                    <div className="flex flex-wrap gap-2">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <label key={n} className="chip cursor-pointer has-[:checked]:border-sun has-[:checked]:text-sun">
                          <input type="radio" name="rating" value={n} defaultChecked={myReview?.rating === n} className="sr-only" required />
                          {n} {n === 1 ? "estrela" : "estrelas"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="review-body" className="sr-only">Comentário da avaliação</label>
                  <textarea id="review-body" name="body" rows={3} maxLength={2000} defaultValue={myReview?.body ?? ""} className="input" placeholder="Conte como foi sua experiência (opcional)" />
                  <SubmitButton pendingText="Enviando...">{myReview ? "Atualizar avaliação" : "Enviar avaliação"}</SubmitButton>
                </ActionForm>
              )}
            </div>
          </section>

          <section aria-labelledby="comentarios" className="card p-5 sm:p-6">
            <h2 id="comentarios" className="section-title mb-4">Comentários ({p.comments.length})</h2>
            {user ? (
              <ActionForm action={addCommentAction} className="mb-6 space-y-3" resetOnSuccess>
                <input type="hidden" name="productId" value={p.id} />
                <label htmlFor="comment-body" className="sr-only">Seu comentário</label>
                <textarea id="comment-body" name="body" rows={3} required minLength={3} maxLength={2000} className="input" placeholder="Escreva um comentário" />
                <SubmitButton pendingText="Publicando...">Comentar</SubmitButton>
              </ActionForm>
            ) : (
              <p className="mb-6 text-sm text-muted"><Link className="text-sun underline" href={`/entrar?next=/mods/${p.slug}`}>Entre</Link> para comentar.</p>
            )}
            {p.comments.length === 0 ? (
              <p className="text-sm text-muted">Nenhum comentário ainda.</p>
            ) : (
              <ul className="space-y-4">
                {p.comments.map((c) => (
                  <li key={c.id} className="rounded-xl bg-surface-2 p-4">
                    <p className="text-sm"><strong>{c.user.name}</strong> <span className="text-xs text-muted">· {formatDate(c.createdAt, true)}</span></p>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-text/90">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <div className="card space-y-4 p-5">
            <PriceTag p={p} size="lg" />
            {action}
            <div className="grid grid-cols-2 gap-2">
              <FavoriteButton productId={p.id} initial={Boolean(favorite)} loggedIn={Boolean(user)} count={p.favoriteCount} />
              <ShareButton title={p.title} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Informações</h2>
            <dl className="space-y-2.5 text-sm">
              <Info k="Categoria" v={p.category?.name} />
              <Info k="Autor" v={p.authorName} />
              <Info k="Versão atual" v={current?.version} />
              <Info k="Última atualização" v={formatDate(p.contentUpdatedAt)} />
              {current?.file && <Info k="Tamanho" v={formatBytes(current.file.size)} />}
              {current?.file && <Info k="Formato" v={current.file.originalName.split(".").pop()?.toUpperCase()} />}
              {p.pricingType === "FREE" && <Info k="Downloads" v={p.downloadCount.toLocaleString("pt-BR")} />}
              <Info k="Compatibilidade" v={p.compatibility} empty="Não informada" />
              <Info k="Framework" v={frameworks.join(", ")} empty="Não informado" />
              {p.gameBuild && <Info k="Versão do jogo/build" v={p.gameBuild} />}
              <Info k="Licença" v={p.licenseName} empty="Não informada" />
              <Info
                k="Entrega"
                v={
                  p.pricingType === "FREE"
                    ? "Download no site"
                    : p.deliveryType === "SITE_FILE"
                    ? "Download na área Meus produtos"
                    : p.deliveryType === "EXTERNAL"
                    ? "Pela plataforma externa"
                    : "Manual pela equipe"
                }
              />
            </dl>
            {p.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Link key={t.tagId} href={`/mods?tag=${t.tag.slug}`} className="chip hover:border-sun hover:text-sun">
                    #{t.tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <p className="px-1 text-xs text-muted">
            Encontrou um problema ou conteúdo publicado sem autorização? <Link href="/legal/remocao" className="text-sun underline">Solicite a remoção</Link>.
          </p>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="relacionados">
          <h2 id="relacionados" className="section-title mb-5">Relacionados</h2>
          <ProductGrid items={related} />
        </section>
      )}
    </div>
  );
}

function Block({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <h2 id={id} className="section-title mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Info({ k, v, empty }: { k: string; v?: string | null; empty?: string }) {
  if (!v && !empty) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className={`text-right ${v ? "" : "italic text-muted"}`}>{v || empty}</dd>
    </div>
  );
}
