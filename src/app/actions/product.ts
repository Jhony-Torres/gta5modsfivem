"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/misc";
import { refreshProductStats } from "@/lib/catalog";
import type { ActionState } from "@/components/forms";

export async function toggleFavoriteAction(productId: string): Promise<{ ok: boolean; favorited?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "login" };
  if (!rateLimit(`fav:${user.id}`, 60, 60_000).ok) return { ok: false, error: "Muitas ações. Aguarde." };
  const product = await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED" }, select: { id: true } });
  if (!product) return { ok: false, error: "Produto não encontrado." };
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await prisma.favorite.findUnique({ where: key });
  if (existing) await prisma.favorite.delete({ where: key });
  else await prisma.favorite.create({ data: { userId: user.id, productId } });
  await refreshProductStats(productId);
  return { ok: true, favorited: !existing };
}

export async function addCommentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para comentar." };
  if (!rateLimit(`comment:${user.id}`, 5, 10 * 60_000).ok) return { error: "Você comentou muitas vezes seguidas. Aguarde alguns minutos." };
  const productId = String(fd.get("productId") || "");
  const body = String(fd.get("body") || "").trim();
  if (body.length < 3) return { error: "Escreva um comentário um pouco maior." };
  if (body.length > 2000) return { error: "Comentário muito longo (máx. 2000 caracteres)." };
  const product = await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED" } });
  if (!product) return { error: "Produto não encontrado." };
  await prisma.comment.create({ data: { productId, userId: user.id, body } });
  revalidatePath(`/mods/${product.slug}`);
  return { ok: true, message: "Comentário publicado." };
}

export async function addReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para avaliar." };
  if (!rateLimit(`review:${user.id}`, 10, 10 * 60_000).ok) return { error: "Aguarde alguns minutos." };
  const productId = String(fd.get("productId") || "");
  const rating = Number(fd.get("rating"));
  const body = String(fd.get("body") || "").trim().slice(0, 2000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Escolha uma nota de 1 a 5." };
  const product = await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED" } });
  if (!product) return { error: "Produto não encontrado." };
  if (product.pricingType === "PAID") {
    const owns = await prisma.entitlement.findFirst({ where: { userId: user.id, productId, revokedAt: null, order: { status: "PAID" } } });
    if (!owns) return { error: "Somente quem comprou este produto pode avaliá-lo." };
  } else {
    const downloaded = await prisma.download.findFirst({ where: { userId: user.id, productId } });
    if (!downloaded) return { error: "Baixe o arquivo com sua conta conectada antes de avaliar." };
  }
  // Uma avaliação por usuário e produto: reenvio atualiza a existente
  await prisma.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, body: body || null },
    create: { productId, userId: user.id, rating, body: body || null },
  });
  await refreshProductStats(productId);
  revalidatePath(`/mods/${product.slug}`);
  return { ok: true, message: "Avaliação registrada. Obrigado!" };
}
