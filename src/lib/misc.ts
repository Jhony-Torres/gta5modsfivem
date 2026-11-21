import { headers } from "next/headers";
import { env } from "./env";
import { prisma } from "./db";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ---------- Limitador simples em memória (por processo). Para vários processos, use Redis.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 50000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

// ---------- IP do cliente
function pickIp(xf: string | null, xr: string | null): string {
  if (env.trustProxy) {
    if (xf) return xf.split(",")[0].trim();
    if (xr) return xr.trim();
  }
  return "direct";
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return pickIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

export function ipFromRequest(req: Request): string {
  return pickIp(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
}

// ---------- Log de auditoria
export async function audit(actorId: string | null, action: string, entity?: string, entityId?: string, details?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        details: details == null ? null : typeof details === "string" ? details : JSON.stringify(details).slice(0, 5000),
      },
    });
  } catch (e) {
    console.error("[audit] falha ao registrar", e);
  }
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Araguaina",
  });
}

export function formatBytes(n: number | bigint | null | undefined) {
  if (n == null) return "—";
  let v = Number(n);
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}

/** Só aceita URLs http(s) — evita javascript: e afins em links cadastrados. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Converte link do YouTube em URL de incorporação. Outros provedores: null. */
export function youtubeEmbed(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    let id: string | null = null;
    if (url.hostname.includes("youtu.be")) id = url.pathname.slice(1);
    else if (url.hostname.includes("youtube.com")) id = url.searchParams.get("v") || url.pathname.split("/").pop() || null;
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {}
  return null;
}
