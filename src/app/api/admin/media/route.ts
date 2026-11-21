import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicUrl, saveStream, UploadError } from "@/lib/storage";
import { audit } from "@/lib/misc";

/**
 * Upload de IMAGEM pública (capa, galeria) em streaming. Somente administradores; verifica a origem.
 * Corpo: o arquivo binário. Cabeçalho X-File-Name: nome original (URL-encoded).
 * Resposta: { url } para usar em coverImage / galeria.
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: "Imagem ausente." }, { status: 400 });
  const name = decodeURIComponent(req.headers.get("x-file-name") || "");
  if (!name) return NextResponse.json({ error: "Nome do arquivo ausente." }, { status: 400 });
  try {
    const saved = await saveStream({ stream: req.body, originalName: name, visibility: "public", kind: "image", folder: "products" });
    await audit(user.id, "media.upload", "Media", saved.key, { size: saved.size });
    return NextResponse.json({ url: publicUrl(saved.key), size: saved.size });
  } catch (e) {
    const msg = e instanceof UploadError ? e.message : "Falha ao salvar a imagem.";
    if (!(e instanceof UploadError)) console.error("[media-upload]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
