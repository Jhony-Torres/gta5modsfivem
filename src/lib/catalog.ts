import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const SORTS = {
  recentes: { label: "Mais recentes", orderBy: [{ publishedAt: "desc" }] },
  atualizados: { label: "Atualizados recentemente", orderBy: [{ contentUpdatedAt: "desc" }] },
  baixados: { label: "Mais baixados", orderBy: [{ downloadCount: "desc" }, { publishedAt: "desc" }] },
  curtidos: { label: "Mais curtidos", orderBy: [{ favoriteCount: "desc" }, { publishedAt: "desc" }] },
  avaliados: { label: "Mais bem avaliados", orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }] },
  "menor-preco": { label: "Menor preço", orderBy: [{ pricingType: "asc" }, { priceCents: "asc" }] },
  "maior-preco": { label: "Maior preço", orderBy: [{ priceCents: "desc" }] },
} as const satisfies Record<string, { label: string; orderBy: Prisma.ProductOrderByWithRelationInput[] }>;

export type SortKey = keyof typeof SORTS;

export type CatalogParams = {
  q?: string;
  categoria?: string;
  preco?: string; // gratis | pago
  framework?: string;
  compat?: string;
  tag?: string;
  versao?: string;
  ordem?: string;
  pagina?: string;
};

export const PAGE_SIZE = 24;

export const publishedWhere: Prisma.ProductWhereInput = { status: "PUBLISHED" };

export async function searchCatalog(params: CatalogParams) {
  const and: Prisma.ProductWhereInput[] = [publishedWhere];
  const q = params.q?.trim().slice(0, 100);
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { shortDescription: { contains: q } },
        { description: { contains: q } },
        { authorName: { contains: q } },
        { category: { name: { contains: q } } },
        { tags: { some: { tag: { name: { contains: q } } } } },
      ],
    });
  }
  if (params.categoria) {
    const cat = await prisma.category.findUnique({ where: { slug: params.categoria }, include: { children: { select: { id: true } } } });
    if (cat) and.push({ categoryId: { in: [cat.id, ...cat.children.map((c) => c.id)] } });
    else and.push({ id: "__none__" });
  }
  if (params.preco === "gratis") and.push({ pricingType: "FREE" });
  if (params.preco === "pago") and.push({ pricingType: "PAID" });
  if (params.framework) and.push({ frameworks: { contains: params.framework.slice(0, 50) } });
  if (params.compat) and.push({ compatibility: { contains: params.compat.slice(0, 50) } });
  if (params.versao) and.push({ gameBuild: { contains: params.versao.slice(0, 50) } });
  if (params.tag) and.push({ tags: { some: { tag: { slug: params.tag } } } });

  const sortKey = (params.ordem && params.ordem in SORTS ? params.ordem : "recentes") as SortKey;
  if (sortKey === "menor-preco" || sortKey === "maior-preco") and.push({ OR: [{ pricingType: "FREE" }, { priceCents: { not: null } }] });

  const page = Math.max(1, Math.min(500, parseInt(params.pagina || "1", 10) || 1));
  const where: Prisma.ProductWhereInput = { AND: and };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: SORTS[sortKey].orderBy as Prisma.ProductOrderByWithRelationInput[],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: cardInclude,
    }),
  ]);
  return { total, items, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), sortKey };
}

export const cardInclude = {
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export async function listCards(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take = 8) {
  return prisma.product.findMany({ where: { AND: [publishedWhere, where] }, orderBy, take, include: cardInclude });
}

/** Valores distintos realmente cadastrados (para montar filtros sem inventar opções). */
export async function filterOptions() {
  const rows = await prisma.product.findMany({
    where: publishedWhere,
    select: { frameworks: true, compatibility: true, gameBuild: true },
  });
  const split = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
  const uniq = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const tags = await prisma.tag.findMany({
    where: { products: { some: { product: publishedWhere } } },
    orderBy: { name: "asc" },
    take: 60,
  });
  return {
    frameworks: uniq(rows.flatMap((r) => split(r.frameworks))),
    compat: uniq(rows.flatMap((r) => split(r.compatibility))),
    versions: uniq(rows.flatMap((r) => split(r.gameBuild))),
    tags,
  };
}

export async function activeCategories() {
  return prisma.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
}

/** Recalcula contadores reais de um produto. */
export async function refreshProductStats(productId: string) {
  const [fav, agg, dl] = await Promise.all([
    prisma.favorite.count({ where: { productId } }),
    prisma.review.aggregate({ where: { productId, status: "VISIBLE" }, _avg: { rating: true }, _count: true }),
    prisma.download.count({ where: { productId } }),
  ]);
  await prisma.product.update({
    where: { id: productId },
    data: { favoriteCount: fav, ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count, downloadCount: dl },
  });
}
