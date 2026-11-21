import { Readable } from "node:stream";
import path from "node:path";
import { IMAGE_TYPES, openRead, statKey } from "@/lib/storage";

/** Serve imagens públicas enviadas pelo painel (somente tipos de imagem). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts?.length || parts.some((p) => p === ".." || p.includes("\\") || p.startsWith("."))) return new Response("Não encontrado", { status: 404 });
  const key = parts.join("/");
  const type = IMAGE_TYPES[path.extname(key).toLowerCase()];
  if (!type) return new Response("Não encontrado", { status: 404 });
  let st;
  try {
    st = await statKey("public", key);
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
  if (!st || !st.isFile()) return new Response("Não encontrado", { status: 404 });
  const stream = Readable.toWeb(openRead("public", key)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(st.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
