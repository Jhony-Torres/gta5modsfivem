import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyToken } from "@/lib/crypto";
import { openRead, statKey } from "@/lib/storage";

/** Entrega de arquivo privado por link temporário assinado. Suporta Range (retomar downloads grandes). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = verifyToken<{ f: string; p: string; u: string | null }>(decodeURIComponent(token));
  if (!data) return new Response("Link de download inválido ou expirado. Volte à página do produto e clique em baixar novamente.", { status: 410 });

  if (data.u) {
    // link de produto pago só funciona para o próprio comprador
    const user = await getCurrentUser();
    if (!user || (user.id !== data.u && user.role !== "ADMIN")) return new Response("Acesso negado.", { status: 403 });
  }
  const file = await prisma.storedFile.findUnique({ where: { id: data.f } });
  if (!file || file.visibility !== "private") return new Response("Arquivo não encontrado.", { status: 404 });
  const st = await statKey("private", file.storageKey);
  if (!st) return new Response("Arquivo não encontrado no armazenamento.", { status: 404 });

  const size = st.size;
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const range = req.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(openRead("private", file.storageKey, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(openRead("private", file.storageKey)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
