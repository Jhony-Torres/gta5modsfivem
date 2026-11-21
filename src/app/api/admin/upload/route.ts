import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { saveStream, UploadError } from "@/lib/storage";
import { audit } from "@/lib/misc";

/**
 * Upload de arquivo PRIVADO de produto, em streaming (suporta arquivos grandes sem carregar em memória).
 * Corpo: o próprio arquivo (binário). Cabeçalho X-File-Name: nome original (URL-encoded).
 * Somente administradores; verifica a origem para evitar CSRF.
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  const name = decodeURIComponent(req.headers.get("x-file-name") || "");
  if (!name) return NextResponse.json({ error: "Nome do arquivo ausente." }, { status: 400 });
  const declared = Number(req.headers.get("content-length") || 0);
  try {
    const saved = await saveStream({ stream: req.body, originalName: name, visibility: "private", kind: "file", folder: "products" });
    if (declared && declared !== saved.size) throw new UploadError("Upload incompleto. Tente novamente.");
    const file = await prisma.storedFile.create({
      data: { storageKey: saved.key, originalName: saved.originalName, mimeType: saved.mimeType, size: BigInt(saved.size), sha256: saved.sha256, visibility: "private" },
    });
    await audit(user.id, "file.upload", "StoredFile", file.id, { name: saved.originalName, size: saved.size, sha256: saved.sha256 });
    return NextResponse.json({ id: file.id, name: file.originalName, size: saved.size, sha256: saved.sha256 });
  } catch (e) {
    const msg = e instanceof UploadError ? e.message : "Falha ao salvar o arquivo.";
    if (!(e instanceof UploadError)) console.error("[upload]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
