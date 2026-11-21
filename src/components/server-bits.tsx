import { getServerStatus } from "@/lib/server-status";
import { getSettings } from "@/lib/settings";
import { safeUrl } from "@/lib/misc";
import { Icon } from "./icons";

export async function ServerStatusCard() {
  const st = await getServerStatus();
  return (
    <div className="card p-5" aria-live="polite">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Status do servidor</h2>
      {st.state === "not_configured" ? (
        <p className="text-sm text-muted">O status em tempo real ainda não foi configurado.</p>
      ) : st.state === "online" ? (
        <div>
          <p className="flex items-center gap-2 font-semibold text-ok">
            <span className="h-2.5 w-2.5 rounded-full bg-ok" aria-hidden="true" /> Online
          </p>
          <p className="mt-2 text-2xl font-bold">
            {st.players}
            {st.maxPlayers ? <span className="text-base font-normal text-muted"> / {st.maxPlayers}</span> : null}{" "}
            <span className="text-sm font-normal text-muted">jogadores conectados</span>
          </p>
          <p className="mt-1 text-xs text-muted">Consultado às {new Date(st.checkedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Araguaina" })}</p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-warn">
          <Icon name="alert" className="h-4 w-4" /> {st.message}
        </p>
      )}
    </div>
  );
}

/** Botão de conexão: só aparece quando o administrador configurou o link/endereço. */
export async function ConnectButton({ className = "btn-primary" }: { className?: string }) {
  const s = await getSettings();
  const url = safeUrl(s["server.connectUrl"]) || (s["server.cfxCode"] ? `https://cfx.re/join/${encodeURIComponent(s["server.cfxCode"])}` : null);
  if (url) {
    return (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        <Icon name="play" className="h-4 w-4" /> Conectar ao servidor
      </a>
    );
  }
  if (s["server.address"]) {
    return (
      <p className="text-sm">
        Endereço para conexão (F8 no FiveM): <code className="rounded bg-surface-3 px-2 py-1">connect {s["server.address"]}</code>
      </p>
    );
  }
  return (
    <span className="chip" title="O endereço de conexão ainda não foi configurado">
      <Icon name="clock" className="h-3.5 w-3.5" /> Endereço de conexão em breve
    </span>
  );
}

export async function SocialButtons() {
  const s = await getSettings();
  const discord = safeUrl(s["social.discord"]);
  const instagram = safeUrl(s["social.instagram"]);
  return (
    <>
      {discord && (
        <a href={discord} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          <Icon name="discord" className="h-4 w-4" /> Discord
        </a>
      )}
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          <Icon name="instagram" className="h-4 w-4" /> Instagram
        </a>
      )}
    </>
  );
}
