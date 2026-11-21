import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "./env";

/**
 * Armazenamento em disco local.
 *  - Público  (imagens): STORAGE_PUBLIC_DIR, servido por /media/...
 *  - Privado  (arquivos de produto): STORAGE_PRIVATE_DIR, entregue só por link temporário assinado.
 * Para usar S3/R2/Wasabi, implemente as mesmas funções (saveStream/openRead/remove) com o SDK do provedor.
 */

export type Visibility = "public" | "private";

export const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export const FILE_TYPES: Record<string, string> = {
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".oiv": "application/octet-stream",
  ".rpf": "application/octet-stream",
  ".lua": "text/plain",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

export class UploadError extends Error {}

function baseDir(v: Visibility) {
  return v === "public" ? env.publicDir : env.privateDir;
}

/** Resolve uma chave dentro do diretório base, bloqueando path traversal. */
export function resolveKey(v: Visibility, key: string) {
  const base = baseDir(v);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new UploadError("Caminho inválido.");
  return full;
}

export function sanitizeFileName(name: string) {
  const ext = path.extname(name).toLowerCase();
  const stem = path
    .basename(name, path.extname(name))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return (stem || "arquivo") + ext;
}

function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  return null;
}

export type SavedFile = { key: string; size: number; sha256: string; mimeType: string; originalName: string };

/**
 * Salva um stream em disco com limite de tamanho, calculando SHA-256.
 * kind "image" valida a assinatura binária (magic bytes) do arquivo.
 */
export async function saveStream(opts: {
  stream: ReadableStream<Uint8Array> | Readable;
  originalName: string;
  visibility: Visibility;
  kind: "image" | "file";
  folder: string;
}): Promise<SavedFile> {
  const { originalName, visibility, kind, folder } = opts;
  const ext = path.extname(originalName).toLowerCase();
  const allowed = kind === "image" ? IMAGE_TYPES : FILE_TYPES;
  if (!allowed[ext]) {
    throw new UploadError(`Tipo de arquivo não permitido (${ext || "sem extensão"}). Permitidos: ${Object.keys(allowed).join(", ")}`);
  }
  const maxBytes = kind === "image" ? env.maxImageBytes : env.maxFileBytes;
  const now = new Date();
  const rand = crypto.randomBytes(8).toString("hex");
  const key = path.posix.join(
    folder.replace(/[^a-z0-9/_-]/gi, ""),
    `${now.getFullYear()}`,
    `${String(now.getMonth() + 1).padStart(2, "0")}`,
    `${rand}-${sanitizeFileName(originalName)}`,
  );
  const full = resolveKey(visibility, key);
  await fsp.mkdir(path.dirname(full), { recursive: true });

  const hash = crypto.createHash("sha256");
  let size = 0;
  let head: Buffer = Buffer.alloc(0);
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > maxBytes) return cb(new UploadError(`Arquivo maior que o limite de ${Math.round(maxBytes / 1048576)} MB.`));
      if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  const src =
    opts.stream instanceof Readable
      ? opts.stream
      : Readable.fromWeb(opts.stream as unknown as import("node:stream/web").ReadableStream);
  try {
    await pipeline(src, meter, fs.createWriteStream(full, { flags: "wx" }));
  } catch (e) {
    await fsp.rm(full, { force: true });
    throw e instanceof UploadError ? e : new UploadError("Falha ao gravar o arquivo.");
  }
  if (size === 0) {
    await fsp.rm(full, { force: true });
    throw new UploadError("Arquivo vazio.");
  }
  let mimeType = allowed[ext];
  if (kind === "image") {
    const sniffed = sniffImage(head);
    if (!sniffed) {
      await fsp.rm(full, { force: true });
      throw new UploadError("O conteúdo do arquivo não é uma imagem válida.");
    }
    mimeType = sniffed;
  }
  return { key, size, sha256: hash.digest("hex"), mimeType, originalName: sanitizeFileName(originalName) };
}

export async function statKey(v: Visibility, key: string) {
  try {
    return await fsp.stat(resolveKey(v, key));
  } catch {
    return null;
  }
}

export function openRead(v: Visibility, key: string, range?: { start: number; end: number }) {
  return fs.createReadStream(resolveKey(v, key), range);
}

export async function removeKey(v: Visibility, key: string) {
  await fsp.rm(resolveKey(v, key), { force: true });
}

/** URL pública de uma imagem armazenada. */
export const publicUrl = (key: string) => `/media/${key}`;
