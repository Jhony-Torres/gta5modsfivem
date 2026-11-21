"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CheckoutType, ComplianceStatus, DeliveryType, PricingType, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { audit, safeUrl, slugify } from "@/lib/misc";
import { parseBRLToCents } from "@/lib/money";
import { MIN_INFINITEPAY_CENTS } from "@/lib/pricing";
import { publicUrl, removeKey, saveStream, UploadError } from "@/lib/storage";
import { refreshProductStats } from "@/lib/catalog";
import type { ActionState } from "@/components/forms";

const str = (fd: FormData, k: string, max = 20000) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const oneOf = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d;

async function saveImage(file: File | null, folder: string) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const saved = await saveStream({ stream: file.stream(), originalName: file.name, visibility: "public", kind: "image", folder });
  return publicUrl(saved.key);
}

/** Regras de publicação: nada pago sem preço, nada vendido sem revisão de conformidade. */
function publicationProblems(d: {
  status: ProductStatus;
  pricingType: PricingType;
  priceCents: number | null;
  checkoutType: CheckoutType;
  deliveryType: DeliveryType;
  externalUrl: string | null;
  complianceStatus: ComplianceStatus;
}): string[] {
  const p: string[] = [];
  if (d.status !== "PUBLISHED") return p;
  if (d.pricingType === "PAID") {
    if (d.priceCents == null || d.priceCents <= 0) p.push("Produto pago precisa de preço definido antes de ser publicado.");
    if (d.checkoutType === "NONE") p.push("Escolha como o produto pago será vendido (InfinitePay, Tebex, Cfx Marketplace ou link externo).");
    if (d.checkoutType === "INFINITEPAY") {
      if ((d.priceCents ?? 0) < MIN_INFINITEPAY_CENTS) p.push("O valor mínimo aceito pela InfinitePay é R$ 1,00.");
      if (d.complianceStatus !== "REVIEWED_OK")
        p.push("Para vender pela InfinitePay, marque a revisão de conformidade (regras Cfx/FiveM/Rockstar e direitos do conteúdo) como concluída.");
      if (d.deliveryType === "EXTERNAL") p.push("Venda pela InfinitePay exige entrega pelo site (arquivo) ou manual.");
    }
  }
  if (["TEBEX", "CFX_MARKETPLACE", "EXTERNAL_LINK"].includes(d.checkoutType) && !d.externalUrl) p.push("Informe o link externo (https://) da plataforma de venda/download.");
  if (d.complianceStatus === "BLOCKED") p.push("Produto marcado como bloqueado na revisão de conformidade.");
  return p;
}

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title", 120);
  if (!title || title.length < 2) return { error: "Informe o título." };
  let slug = slugify(str(fd, "slug", 140) || title);
  if (!slug) return { error: "Slug inválido." };
  const clash = await prisma.product.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const pricingType = oneOf(fd.get("pricingType"), ["FREE", "PAID"] as const, "FREE");
  const status = oneOf(fd.get("status"), ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const, "DRAFT");
  let checkoutType = oneOf(fd.get("checkoutType"), ["NONE", "INFINITEPAY", "TEBEX", "CFX_MARKETPLACE", "EXTERNAL_LINK"] as const, "NONE");
  const deliveryType = oneOf(fd.get("deliveryType"), ["SITE_FILE", "EXTERNAL", "MANUAL"] as const, "SITE_FILE");
  const complianceStatus = oneOf(fd.get("complianceStatus"), ["NOT_REVIEWED", "REVIEWED_OK", "BLOCKED"] as const, "NOT_REVIEWED");

  const rawPrice = str(fd, "price", 30);
  const rawPromo = str(fd, "promoPrice", 30);
  let priceCents = rawPrice ? parseBRLToCents(rawPrice) : null;
  let promoPriceCents = rawPromo ? parseBRLToCents(rawPromo) : null;
  if (rawPrice && priceCents == null) return { error: "Preço inválido. Use o formato 19,90." };
  if (rawPromo && promoPriceCents == null) return { error: "Preço promocional inválido." };
  if (pricingType === "FREE") {
    priceCents = null;
    promoPriceCents = null;
    if (checkoutType === "INFINITEPAY") checkoutType = "NONE";
  }
  if (promoPriceCents != null && priceCents != null && promoPriceCents >= priceCents) return { error: "O preço promocional deve ser menor que o preço normal." };
  const promoEndsRaw = str(fd, "promoEndsAt", 30);
  const promoEndsAt = promoEndsRaw ? new Date(promoEndsRaw) : null;
  if (promoEndsAt && isNaN(promoEndsAt.getTime())) return { error: "Data de fim da promoção inválida." };

  const externalRaw = str(fd, "externalUrl", 500);
  const externalUrl = externalRaw ? safeUrl(externalRaw) : null;
  if (externalRaw && !externalUrl) return { error: "Link externo inválido (use https://)." };
  const videoRaw = str(fd, "videoUrl", 500);
  const videoUrl = videoRaw ? safeUrl(videoRaw) : null;
  if (videoRaw && !videoUrl) return { error: "Link do vídeo inválido." };

  const problems = publicationProblems({ status, pricingType, priceCents, checkoutType, deliveryType, externalUrl, complianceStatus });
  if (status === "PUBLISHED" && pricingType === "PAID" && checkoutType === "INFINITEPAY" && deliveryType === "SITE_FILE") {
    const hasFile = id ? await prisma.productVersion.count({ where: { productId: id, fileId: { not: null } } }) : 0;
    if (!hasFile) problems.push("Envie o arquivo (crie uma versão) antes de publicar um produto pago entregue pelo site. Salve como rascunho primeiro.");
  }
  if (problems.length) return { error: problems.join(" ") };

  const categoryId = str(fd, "categoryId", 40);
  if (categoryId && !(await prisma.category.findUnique({ where: { id: categoryId } }))) return { error: "Categoria inválida." };

  let cover: string | null | undefined = undefined;
  try {
    const img = await saveImage(fd.get("cover") as File | null, "products");
    if (img) cover = img;
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha no envio da capa." };
  }
  if (fd.get("removeCover") === "on") cover = null;

  const data = {
    title,
    slug,
    shortDescription: str(fd, "shortDescription", 300),
    description: str(fd, "description"),
    categoryId,
    authorName: str(fd, "authorName", 120),
    credits: str(fd, "credits"),
    licenseName: str(fd, "licenseName", 120),
    licenseText: str(fd, "licenseText"),
    status,
    pricingType,
    priceCents,
    promoPriceCents,
    promoEndsAt,
    checkoutType,
    deliveryType: pricingType === "FREE" ? ("SITE_FILE" as const) : deliveryType,
    externalUrl,
    requireLogin: fd.get("requireLogin") === "on",
    complianceStatus,
    complianceNotes: str(fd, "complianceNotes"),
    compatibility: str(fd, "compatibility", 200),
    frameworks: str(fd, "frameworks", 200),
    gameBuild: str(fd, "gameBuild", 100),
    requirements: str(fd, "requirements"),
    dependencies: str(fd, "dependencies"),
    installation: str(fd, "installation"),
    featured: fd.get("featured") === "on",
    featuredOrder: Number(fd.get("featuredOrder")) || 0,
    videoUrl,
    ...(cover !== undefined ? { coverImage: cover } : {}),
  };

  const tagNames = (str(fd, "tags", 1000) || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const ts = slugify(name);
    if (!ts) continue;
    const tag = await prisma.tag.upsert({ where: { slug: ts }, update: {}, create: { slug: ts, name: name.slice(0, 50) } });
    tagIds.push(tag.id);
  }

  let productId = id;
  if (id) {
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) return { error: "Produto não encontrado." };
    const becamePublished = before.status !== "PUBLISHED" && status === "PUBLISHED";
    const contentChanged = before.status === "PUBLISHED" && (before.description !== data.description || before.installation !== data.installation);
    await prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(becamePublished && !before.publishedAt ? (() => { const n = new Date(); return { publishedAt: n, contentUpdatedAt: n }; })() : {}),
        ...(contentChanged ? { contentUpdatedAt: new Date() } : {}),
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    const priceChanged = before.priceCents !== data.priceCents || before.promoPriceCents !== data.promoPriceCents;
    await audit(admin.id, priceChanged ? "product.update+price" : "product.update", "Product", id, {
      status,
      ...(priceChanged ? { priceBefore: before.priceCents, priceAfter: data.priceCents, promoBefore: before.promoPriceCents, promoAfter: data.promoPriceCents } : {}),
    });
  } else {
    const now = new Date();
    const created = await prisma.product.create({
      data: {
        ...data,
        publishedAt: status === "PUBLISHED" ? now : null,
        contentUpdatedAt: now,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    productId = created.id;
    await audit(admin.id, "product.create", "Product", created.id, { title, status, pricingType, priceCents });
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/produtos/${productId}?criado=1`);
  return { ok: true, message: "Produto salvo." };
}

export async function deleteProductAction(fd: FormData) {
  const admin = await assertAdmin();
  const id = String(fd.get("id"));
  const hasOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (hasOrders > 0) {
    // Preserva histórico: apenas despublica
    await prisma.product.update({ where: { id }, data: { status: "UNPUBLISHED" } });
    await audit(admin.id, "product.unpublish(has-orders)", "Product", id);
  } else {
    const p = await prisma.product.delete({ where: { id } });
    await audit(admin.id, "product.delete", "Product", id, { title: p.title });
  }
  revalidatePath("/", "layout");
  redirect("/admin/produtos");
}

export async function addImagesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const productId = String(fd.get("productId"));
  const files = fd.getAll("images").filter((f): f is File => typeof f !== "string" && f.size > 0).slice(0, 12);
  if (!files.length) return { error: "Selecione ao menos uma imagem." };
  const count = await prisma.productImage.count({ where: { productId } });
  try {
    let i = count;
    for (const f of files) {
      const url = await saveImage(f, "products");
      if (url) await prisma.productImage.create({ data: { productId, url, alt: str(fd, "alt", 200), sortOrder: i++ } });
    }
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha no envio." };
  }
  await audit(admin.id, "product.images.add", "Product", productId, { count: files.length });
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, message: `${files.length} imagem(ns) adicionada(s).` };
}

export async function removeImageAction(fd: FormData) {
  const admin = await assertAdmin();
  const img = await prisma.productImage.delete({ where: { id: String(fd.get("id")) } });
  if (img.url.startsWith("/media/")) await removeKey("public", img.url.slice(7)).catch(() => {});
  await audit(admin.id, "product.images.remove", "Product", img.productId);
  revalidatePath(`/admin/produtos/${img.productId}`);
}

export async function setCurrentVersionAction(fd: FormData) {
  const admin = await assertAdmin();
  const v = await prisma.productVersion.findUnique({ where: { id: String(fd.get("id")) } });
  if (!v) return;
  await prisma.$transaction([
    prisma.productVersion.updateMany({ where: { productId: v.productId }, data: { isCurrent: false } }),
    prisma.productVersion.update({ where: { id: v.id }, data: { isCurrent: true } }),
    prisma.product.update({ where: { id: v.productId }, data: { contentUpdatedAt: new Date() } }),
  ]);
  await audit(admin.id, "product.version.current", "Product", v.productId, { version: v.version });
  revalidatePath(`/admin/produtos/${v.productId}`);
}

export async function deleteVersionAction(fd: FormData) {
  const admin = await assertAdmin();
  const v = await prisma.productVersion.findUnique({ where: { id: String(fd.get("id")) } });
  if (!v) return;
  // O arquivo é mantido no armazenamento (pode estar vinculado a downloads/pedidos antigos).
  await prisma.productVersion.delete({ where: { id: v.id } });
  await audit(admin.id, "product.version.delete", "Product", v.productId, { version: v.version, fileId: v.fileId });
  revalidatePath(`/admin/produtos/${v.productId}`);
}

export async function recountStatsAction(fd: FormData) {
  await assertAdmin();
  await refreshProductStats(String(fd.get("id")));
  revalidatePath(`/admin/produtos/${fd.get("id")}`);
}

// ------------------------------------------------------------------ Categorias

export async function saveCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name", 80);
  if (!name) return { error: "Informe o nome." };
  const slug = slugify(str(fd, "slug", 90) || name);
  const clash = await prisma.category.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { error: "Já existe uma categoria com este slug." };
  const parentId = str(fd, "parentId", 40);
  if (parentId && parentId === id) return { error: "Uma categoria não pode ser subcategoria dela mesma." };
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.parentId) return { error: "Subcategorias só podem ficar dentro de uma categoria principal." };
  }
  let imageUrl: string | undefined;
  try {
    imageUrl = (await saveImage(fd.get("image") as File | null, "categories")) ?? undefined;
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha no envio da imagem." };
  }
  const data = {
    name,
    slug,
    description: str(fd, "description", 2000),
    icon: str(fd, "icon", 40),
    sortOrder: Number(fd.get("sortOrder")) || 0,
    active: fd.get("active") === "on",
    parentId,
    ...(imageUrl ? { imageUrl } : {}),
    ...(fd.get("removeImage") === "on" ? { imageUrl: null } : {}),
  };
  if (id) await prisma.category.update({ where: { id }, data });
  else await prisma.category.create({ data });
  await audit(admin.id, id ? "category.update" : "category.create", "Category", id ?? slug, { name });
  revalidatePath("/", "layout");
  return { ok: true, message: "Categoria salva." };
}

export async function deleteCategoryAction(fd: FormData) {
  const admin = await assertAdmin();
  const id = String(fd.get("id"));
  const used = await prisma.product.count({ where: { categoryId: id } });
  if (used > 0) {
    await prisma.category.update({ where: { id }, data: { active: false } });
    await audit(admin.id, "category.deactivate(in-use)", "Category", id);
  } else {
    await prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await prisma.category.delete({ where: { id } });
    await audit(admin.id, "category.delete", "Category", id);
  }
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ Versões

export async function createVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const productId = String(fd.get("productId"));
  const version = str(fd, "version", 40);
  const fileId = str(fd, "fileId", 40);
  if (!version) return { error: "Informe o número da versão (ex.: 1.0.0)." };
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Produto não encontrado." };
  if (await prisma.productVersion.findFirst({ where: { productId, version } })) return { error: "Já existe uma versão com esse número." };
  if (fileId && !(await prisma.storedFile.findUnique({ where: { id: fileId } }))) return { error: "Arquivo enviado não encontrado." };
  const makeCurrent = fd.get("makeCurrent") === "on";
  await prisma.$transaction(async (tx) => {
    if (makeCurrent) await tx.productVersion.updateMany({ where: { productId }, data: { isCurrent: false } });
    await tx.productVersion.create({ data: { productId, version, changelog: str(fd, "changelog"), fileId, isCurrent: makeCurrent } });
    if (makeCurrent) await tx.product.update({ where: { id: productId }, data: { contentUpdatedAt: new Date() } });
  });
  await audit(admin.id, "product.version.create", "Product", productId, { version, fileId });
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, message: `Versão ${version} criada.` };
}
