import Link from "next/link";
import { activeCategories, filterOptions, searchCatalog, SORTS, type CatalogParams } from "@/lib/catalog";
import { EmptyState, PageHeader, Pagination, ProductGrid } from "./ui";
import { Icon } from "./icons";

function buildHref(base: string, params: Record<string, string | undefined>, override: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...override })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export async function CatalogView({
  basePath,
  params,
  fixedPrice,
  title,
  subtitle,
  eyebrow,
}: {
  basePath: string;
  params: CatalogParams;
  fixedPrice?: "gratis" | "pago";
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  const effective = { ...params, ...(fixedPrice ? { preco: fixedPrice } : {}) };
  const [result, cats, opts] = await Promise.all([searchCatalog(effective), activeCategories(), filterOptions()]);
  const current: Record<string, string | undefined> = { ...params };
  delete current.pagina;
  const hasFilters = Boolean(params.q || params.categoria || params.framework || params.compat || params.tag || params.versao || (!fixedPrice && params.preco));

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow}>
        <form action={basePath} className="flex max-w-2xl gap-2" role="search">
          {Object.entries(current)
            .filter(([k, v]) => v && k !== "q")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <label htmlFor="cat-q" className="sr-only">
            Pesquisar
          </label>
          <input id="cat-q" name="q" type="search" defaultValue={params.q} placeholder="Nome, descrição, autor, categoria ou tag" className="input h-12" maxLength={100} />
          <button className="btn-primary h-12 px-5" type="submit">
            <Icon name="search" className="h-4 w-4" /> Buscar
          </button>
        </form>
      </PageHeader>

      <div className="container-pto mt-6">
        {cats.length > 0 && (
          <nav aria-label="Categorias" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            <Link href={buildHref(basePath, current, { categoria: undefined })} className={!params.categoria ? "btn-primary shrink-0 py-1.5" : "btn-secondary shrink-0 py-1.5"}>
              Todas
            </Link>
            {cats.map((c) => (
              <Link
                key={c.id}
                href={buildHref(basePath, current, { categoria: c.slug })}
                className={params.categoria === c.slug ? "btn-primary shrink-0 py-1.5" : "btn-secondary shrink-0 py-1.5"}
              >
                <Icon name={c.icon || "box"} className="h-4 w-4" /> {c.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside>
            <form action={basePath} className="card space-y-4 p-4 lg:sticky lg:top-32" aria-label="Filtros">
              <h2 className="font-semibold">Filtros</h2>
              {params.q && <input type="hidden" name="q" value={params.q} />}
              <div>
                <label className="label" htmlFor="f-categoria">Categoria</label>
                <select id="f-categoria" name="categoria" defaultValue={params.categoria ?? ""} className="input">
                  <option value="">Todas</option>
                  {cats.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.slug}>{c.name} (todas)</option>
                      {c.children.map((s) => (
                        <option key={s.id} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {!fixedPrice && (
                <div>
                  <label className="label" htmlFor="f-preco">Preço</label>
                  <select id="f-preco" name="preco" defaultValue={params.preco ?? ""} className="input">
                    <option value="">Gratuitos e pagos</option>
                    <option value="gratis">Somente gratuitos</option>
                    <option value="pago">Somente pagos</option>
                  </select>
                </div>
              )}
              {opts.frameworks.length > 0 && (
                <div>
                  <label className="label" htmlFor="f-fw">Framework</label>
                  <select id="f-fw" name="framework" defaultValue={params.framework ?? ""} className="input">
                    <option value="">Qualquer</option>
                    {opts.frameworks.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
              {opts.compat.length > 0 && (
                <div>
                  <label className="label" htmlFor="f-compat">Compatibilidade informada</label>
                  <select id="f-compat" name="compat" defaultValue={params.compat ?? ""} className="input">
                    <option value="">Qualquer</option>
                    {opts.compat.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
              {opts.versions.length > 0 && (
                <div>
                  <label className="label" htmlFor="f-versao">Versão / build</label>
                  <select id="f-versao" name="versao" defaultValue={params.versao ?? ""} className="input">
                    <option value="">Qualquer</option>
                    {opts.versions.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
              {opts.tags.length > 0 && (
                <div>
                  <label className="label" htmlFor="f-tag">Tag</label>
                  <select id="f-tag" name="tag" defaultValue={params.tag ?? ""} className="input">
                    <option value="">Qualquer</option>
                    {opts.tags.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="f-ordem">Ordenar por</label>
                <select id="f-ordem" name="ordem" defaultValue={result.sortKey} className="input">
                  {Object.entries(SORTS)
                    .filter(([k]) => !(fixedPrice === "gratis" && k.includes("preco")))
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                </select>
              </div>
              <button className="btn-primary w-full" type="submit">
                Aplicar filtros
              </button>
              {hasFilters && (
                <Link href={basePath} className="btn-ghost w-full">
                  Limpar filtros
                </Link>
              )}
            </form>
          </aside>

          <div>
            <p className="mb-4 text-sm text-muted" aria-live="polite">
              {result.total === 0 ? "Nenhum resultado" : `${result.total.toLocaleString("pt-BR")} ${result.total === 1 ? "resultado" : "resultados"}`}
              {params.q ? <> para “{params.q}”</> : null}
            </p>
            <ProductGrid
              items={result.items}
              empty={
                <EmptyState
                  icon="search"
                  title={hasFilters ? "Nenhum item encontrado com esses filtros" : "Ainda não há itens publicados aqui"}
                  text={hasFilters ? "Tente remover alguns filtros ou pesquisar outro termo." : "Novos conteúdos aparecerão assim que forem publicados pela equipe."}
                  action={hasFilters ? <Link href={basePath} className="btn-secondary">Limpar filtros</Link> : undefined}
                />
              }
            />
            <Pagination page={result.page} pages={result.pages} makeHref={(p) => buildHref(basePath, current, { pagina: String(p) })} />
          </div>
        </div>
      </div>
    </>
  );
}
