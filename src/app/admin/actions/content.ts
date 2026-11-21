"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { audit, safeUrl, slugify } from "@/lib/misc";
import { publicUrl, saveStream, UploadError } from "@/lib/storage";
import { SETTING_DEFAULTS, saveSettings, type SettingKey } from "@/lib/settings";
import { refreshProductStats } from "@/lib/catalog";
import type { ActionState } from "@/components/forms";

const str = (fd: FormData, k: string, max = 50000) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

async function img(fd: FormData, key: string, folder: string) {
  const f = fd.get(key) as File | null;
  if (!f || typeof f === "string" || f.size === 0) return undefined;
  const s = await saveStream({ stream: f.stream(), originalName: f.name, visibility: "public", kind: "image", folder });
  return publicUrl(s.key);
}

function wrap(fn: (fd: FormData, adminId: string) => Promise<string | void>) {
  return async (_: ActionState, fd: FormData): Promise<ActionState> => {
    const admin = await assertAdmin();
    try {
      const msg = await fn(fd, admin.id);
      revalidatePath("/", "layout");
      return { ok: true, message: msg || "Salvo." };
    } catch (e) {
      if (e instanceof UploadError || e instanceof Error) return { error: e.message };
      return { error: "Erro ao salvar." };
    }
  };
}

// ------------------------------------------------------------------ Configurações

export const saveSettingsAction = wrap(async (fd, adminId) => {
  const values: Partial<Record<SettingKey, string>> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    if (!fd.has(key)) continue;
    let v = String(fd.get(key) ?? "").trim().slice(0, 20000);
    if ((key.startsWith("social.") || key === "server.connectUrl" || key === "server.videoUrl") && v && !safeUrl(v)) {
      throw new Error(`Link inválido em "${key}". Use https://`);
    }
    if (key === "contact.email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error("E-mail de contato inválido.");
    if (key === "server.statusMode" && !["none", "cfx", "direct"].includes(v)) v = "none";
    values[key] = v;
  }
  for (const [field, key] of [["heroImageFile", "home.heroImage"], ["serverImageFile", "server.heroImage"]] as const) {
    const url = await img(fd, field, "site");
    if (url) values[key] = url;
  }
  await saveSettings(values);
  await audit(adminId, "settings.update", "Setting", undefined, Object.keys(values));
  return "Configurações salvas.";
});

// ------------------------------------------------------------------ Páginas

export const savePageAction = wrap(async (fd, adminId) => {
  const slug = str(fd, "slug", 80);
  const title = str(fd, "title", 150);
  const body = str(fd, "body") ?? "";
  if (!slug || !title) throw new Error("Título obrigatório.");
  const needsReview = fd.get("reviewed") !== "on";
  await prisma.page.upsert({ where: { slug }, update: { title, body, needsReview }, create: { slug, title, body, needsReview } });
  await audit(adminId, "page.update", "Page", slug, { needsReview });
  return "Página salva.";
});

// ------------------------------------------------------------------ Posts

export const savePostAction = wrap(async (fd, adminId) => {
  const id = str(fd, "id");
  const title = str(fd, "title", 160);
  if (!title) throw new Error("Informe o título.");
  let slug = slugify(str(fd, "slug", 160) || title);
  if (await prisma.post.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } })) slug += "-" + Date.now().toString(36).slice(-4);
  const type = (["NEWS", "UPDATE", "TUTORIAL"] as const).find((t) => t === fd.get("type")) ?? "NEWS";
  const published = fd.get("published") === "on";
  const cover = await img(fd, "cover", "posts");
  const data = { title, slug, type, excerpt: str(fd, "excerpt", 400), body: str(fd, "body") ?? "", published, ...(cover ? { coverImage: cover } : {}) };
  if (id) {
    const before = await prisma.post.findUnique({ where: { id } });
    await prisma.post.update({ where: { id }, data: { ...data, ...(published && !before?.publishedAt ? { publishedAt: new Date() } : {}) } });
  } else {
    await prisma.post.create({ data: { ...data, publishedAt: published ? new Date() : null } });
  }
  await audit(adminId, id ? "post.update" : "post.create", "Post", id ?? slug);
  return "Publicação salva.";
});

// ------------------------------------------------------------------ Eventos

export const saveEventAction = wrap(async (fd, adminId) => {
  const id = str(fd, "id");
  const title = str(fd, "title", 160);
  const startsAt = new Date(String(fd.get("startsAt")));
  if (!title) throw new Error("Informe o título.");
  if (isNaN(startsAt.getTime())) throw new Error("Data de início inválida.");
  const endsRaw = str(fd, "endsAt");
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  const cover = await img(fd, "cover", "events");
  const data = { title, startsAt, endsAt, location: str(fd, "location", 160), description: str(fd, "description"), published: fd.get("published") === "on", ...(cover ? { coverImage: cover } : {}) };
  if (id) await prisma.event.update({ where: { id }, data });
  else await prisma.event.create({ data });
  await audit(adminId, id ? "event.update" : "event.create", "Event", id ?? title);
  return "Evento salvo.";
});

// ------------------------------------------------------------------ FAQ

export const saveFaqAction = wrap(async (fd, adminId) => {
  const id = str(fd, "id");
  const question = str(fd, "question", 300);
  const answer = str(fd, "answer");
  if (!question || !answer) throw new Error("Pergunta e resposta são obrigatórias.");
  const data = { question, answer, sortOrder: Number(fd.get("sortOrder")) || 0, published: fd.get("published") === "on" };
  if (id) await prisma.faq.update({ where: { id }, data });
  else await prisma.faq.create({ data });
  await audit(adminId, id ? "faq.update" : "faq.create", "Faq", id ?? undefined);
  return "Pergunta salva.";
});

// ------------------------------------------------------------------ Servidor: recursos e mídia

export const saveFeatureAction = wrap(async (fd, adminId) => {
  const id = str(fd, "id");
  const title = str(fd, "title", 120);
  if (!title) throw new Error("Informe o título.");
  const kind = (["ATIVIDADE", "PROFISSAO", "LOCAL", "SISTEMA"] as const).find((k) => k === fd.get("kind")) ?? "ATIVIDADE";
  const image = await img(fd, "image", "server");
  const data = { kind, title, description: str(fd, "description"), sortOrder: Number(fd.get("sortOrder")) || 0, published: fd.get("published") === "on", ...(image ? { imageUrl: image } : {}) };
  if (id) await prisma.serverFeature.update({ where: { id }, data });
  else await prisma.serverFeature.create({ data });
  await audit(adminId, id ? "feature.update" : "feature.create", "ServerFeature", id ?? title);
  return "Item salvo.";
});

export const addMediaAction = wrap(async (fd, adminId) => {
  const type = fd.get("type") === "VIDEO" ? "VIDEO" : "IMAGE";
  let url: string | undefined;
  if (type === "IMAGE") url = await img(fd, "file", "server");
  else url = safeUrl(str(fd, "url", 500)) ?? undefined;
  if (!url) throw new Error(type === "IMAGE" ? "Selecione uma imagem." : "Informe o link do vídeo (https://).");
  await prisma.serverMedia.create({ data: { type, url, caption: str(fd, "caption", 200), sortOrder: Number(fd.get("sortOrder")) || 0 } });
  await audit(adminId, "media.add", "ServerMedia", undefined, { type });
  return "Mídia adicionada.";
});

// ------------------------------------------------------------------ Remoções genéricas

const DELETABLE = {
  post: (id: string) => prisma.post.delete({ where: { id } }),
  event: (id: string) => prisma.event.delete({ where: { id } }),
  faq: (id: string) => prisma.faq.delete({ where: { id } }),
  feature: (id: string) => prisma.serverFeature.delete({ where: { id } }),
  media: (id: string) => prisma.serverMedia.delete({ where: { id } }),
} as const;

export async function deleteEntityAction(fd: FormData) {
  const admin = await assertAdmin();
  const kind = String(fd.get("kind")) as keyof typeof DELETABLE;
  const id = String(fd.get("id"));
  if (!DELETABLE[kind]) return;
  await DELETABLE[kind](id);
  await audit(admin.id, `${kind}.delete`, kind, id);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ Moderação

export async function moderateAction(fd: FormData) {
  const admin = await assertAdmin();
  const kind = fd.get("kind") === "review" ? "review" : "comment";
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  let productId: string | null = null;
  if (kind === "review") {
    const r =
      op === "delete"
        ? await prisma.review.delete({ where: { id } })
        : await prisma.review.update({ where: { id }, data: { status: op === "hide" ? "HIDDEN" : "VISIBLE" } });
    productId = r.productId;
    await refreshProductStats(r.productId);
  } else {
    const c =
      op === "delete"
        ? await prisma.comment.delete({ where: { id } })
        : await prisma.comment.update({ where: { id }, data: { status: op === "hide" ? "HIDDEN" : "VISIBLE" } });
    productId = c.productId;
  }
  await audit(admin.id, `${kind}.${op}`, kind, id, { productId });
  revalidatePath("/admin/moderacao");
}

// ------------------------------------------------------------------ Sugestões

export async function reviewSuggestionAction(fd: FormData) {
  const admin = await assertAdmin();
  const id = String(fd.get("id"));
  const status = fd.get("status") === "APPROVED" ? "APPROVED" : fd.get("status") === "REJECTED" ? "REJECTED" : "PENDING";
  await prisma.suggestion.update({ where: { id }, data: { status, adminNotes: str(fd, "adminNotes", 2000) } });
  await audit(admin.id, "suggestion.review", "Suggestion", id, { status });
  revalidatePath("/admin/sugestoes");
}

// ------------------------------------------------------------------ Usuários

export async function userAdminAction(fd: FormData) {
  const admin = await assertAdmin();
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  if (id === admin.id) return; // não altera a própria conta por aqui
  if (op === "block") {
    await prisma.user.update({ where: { id }, data: { status: "BLOCKED" } });
    await prisma.session.deleteMany({ where: { userId: id } });
  } else if (op === "unblock") await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
  else if (op === "makeAdmin") await prisma.user.update({ where: { id }, data: { role: "ADMIN" } });
  else if (op === "removeAdmin") await prisma.user.update({ where: { id }, data: { role: "USER" } });
  else return;
  await audit(admin.id, `user.${op}`, "User", id);
  revalidatePath("/admin/usuarios");
}
