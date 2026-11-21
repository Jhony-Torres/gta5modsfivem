import { getSettings } from "./settings";

export type ServerStatus =
  | { state: "not_configured" }
  | { state: "online"; players: number; maxPlayers: number | null; hostname: string | null; checkedAt: string }
  | { state: "offline" | "error"; message: string; checkedAt: string };

let cached: { at: number; key: string; value: ServerStatus } | null = null;
const CACHE_MS = 60_000;

async function getJson(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Consulta o status apenas quando configurado no painel:
 *  - cfx:    código cfx.re/join → servers-frontend.fivem.net
 *  - direct: endereço http(s)://IP:PORTA do servidor (usa /dynamic.json do FXServer)
 * Em caso de falha, informa a falha — nunca inventa números.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const s = await getSettings();
  const mode = s["server.statusMode"];
  const endpoint = (s["server.statusEndpoint"] || "").trim();
  const code = (s["server.cfxCode"] || "").trim();
  if (mode === "none" || (mode === "cfx" && !code) || (mode === "direct" && !endpoint)) return { state: "not_configured" };
  const key = `${mode}|${endpoint}|${code}`;
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.value;

  const checkedAt = new Date().toISOString();
  let value: ServerStatus;
  try {
    if (mode === "cfx") {
      if (!/^[a-z0-9]{4,10}$/i.test(code)) throw new Error("Código cfx.re inválido");
      const data = await getJson(`https://servers-frontend.fivem.net/api/servers/single/${code}`);
      const d = data?.Data;
      if (!d) throw new Error("Resposta sem dados");
      value = {
        state: "online",
        players: Number(d.clients ?? d.players?.length ?? 0),
        maxPlayers: d.sv_maxclients != null ? Number(d.sv_maxclients) : d.svMaxclients != null ? Number(d.svMaxclients) : null,
        hostname: typeof d.hostname === "string" ? d.hostname.replace(/\^\d/g, "").slice(0, 120) : null,
        checkedAt,
      };
    } else {
      const base = endpoint.replace(/\/$/, "");
      if (!/^https?:\/\//.test(base)) throw new Error("Endereço deve começar com http:// ou https://");
      const d = await getJson(`${base}/dynamic.json`);
      value = {
        state: "online",
        players: Number(d.clients ?? 0),
        maxPlayers: d.sv_maxclients != null ? Number(d.sv_maxclients) : null,
        hostname: typeof d.hostname === "string" ? d.hostname.replace(/\^\d/g, "").slice(0, 120) : null,
        checkedAt,
      };
    }
  } catch (e) {
    value = { state: "error", message: "Não foi possível consultar o servidor agora.", checkedAt };
    console.warn("[server-status]", (e as Error).message);
  }
  cached = { at: Date.now(), key, value };
  return value;
}
