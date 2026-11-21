import { getSettings, type SettingKey } from "@/lib/settings";
import { infinitePayStatus } from "@/lib/infinitepay";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { saveSettingsAction } from "../actions/content";

type F = { key: SettingKey; label: string; hint?: string; type?: "text" | "textarea" | "url" | "email" | "select"; options?: [string, string][] };

const SECTIONS: { title: string; fields: F[] }[] = [
  {
    title: "Página inicial",
    fields: [
      { key: "site.name", label: "Nome do site" },
      { key: "site.tagline", label: "Frase curta (rodapé)" },
      { key: "home.heroTitle", label: "Título principal" },
      { key: "home.heroText", label: "Texto de apresentação", type: "textarea" },
      { key: "home.serverCardText", label: "Texto do cartão do servidor" },
      { key: "home.modsCardText", label: "Texto do cartão de mods" },
    ],
  },
  {
    title: "Redes sociais e contato",
    fields: [
      { key: "social.discord", label: "Discord", type: "url" },
      { key: "social.instagram", label: "Instagram", type: "url" },
      { key: "social.youtube", label: "YouTube (opcional)", type: "url" },
      { key: "social.tiktok", label: "TikTok (opcional)", type: "url" },
      { key: "contact.responsible", label: "Responsável" },
      { key: "contact.email", label: "E-mail de contato", type: "email", hint: "Exibido no rodapé, contato e páginas legais." },
      { key: "contact.whatsapp", label: "WhatsApp (opcional)" },
    ],
  },
  {
    title: "Dados legais (páginas de termos e políticas)",
    fields: [
      { key: "legal.entityName", label: "Nome ou razão social do responsável pelas vendas" },
      { key: "legal.document", label: "CPF/CNPJ a exibir (se aplicável)", hint: "Avalie com um contador/advogado o que precisa ser exibido." },
      { key: "legal.city", label: "Cidade/UF (foro)" },
    ],
  },
  {
    title: "Servidor Palmas TO",
    fields: [
      { key: "server.intro", label: "Apresentação do servidor (Markdown)", type: "textarea" },
      { key: "server.connectUrl", label: "Link de conexão", type: "url", hint: "Ex.: https://cfx.re/join/xxxxxx (se tiver)." },
      { key: "server.cfxCode", label: "Código cfx.re/join", hint: "Somente o código (ex.: abc123). Usado no botão e no status." },
      { key: "server.address", label: "Endereço IP:porta (alternativa)", hint: "Exibido como comando connect no F8." },
      { key: "server.videoUrl", label: "Vídeo de apresentação", type: "url" },
      {
        key: "server.statusMode",
        label: "Fonte do status em tempo real",
        type: "select",
        options: [["none", "Desativado"], ["cfx", "Lista oficial do FiveM (código cfx.re)"], ["direct", "Consulta direta ao servidor (http://IP:PORTA)"]],
      },
      { key: "server.statusEndpoint", label: "Endereço para consulta direta", hint: "Ex.: http://123.45.67.89:30120 — o servidor precisa expor /dynamic.json." },
    ],
  },
  {
    title: "Loja e downloads",
    fields: [{ key: "store.notice", label: "Aviso exibido na loja (opcional)", type: "textarea" }],
  },
];

export default async function SettingsPage() {
  const s = await getSettings();
  const ip = infinitePayStatus();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Configurações</h1>
      <Notice title="Credenciais ficam fora do painel">
        A InfiniteTag, a chave da API InfinitePay, o banco e o SMTP são configurados no arquivo <code>.env</code> do servidor (ou nas variáveis de ambiente
        da hospedagem) — nunca aqui. Situação atual: handle {ip.hasHandle ? "configurado" : "ausente"}, API key {ip.hasApiKey ? "configurada" : "ausente"},
        cobranças {ip.enabled ? "habilitadas" : "desabilitadas"}.
      </Notice>
      <ActionForm action={saveSettingsAction} className="space-y-5">
        {SECTIONS.map((sec) => (
          <fieldset key={sec.title} className="card space-y-4 p-5">
            <legend className="sr-only">{sec.title}</legend>
            <h2 className="font-semibold">{sec.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {sec.fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                  <label className="label" htmlFor={f.key}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea id={f.key} name={f.key} rows={f.key === "server.intro" ? 8 : 3} defaultValue={s[f.key]} className="input" />
                  ) : f.type === "select" ? (
                    <select id={f.key} name={f.key} defaultValue={s[f.key]} className="input">
                      {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input id={f.key} name={f.key} type={f.type ?? "text"} defaultValue={s[f.key]} className="input" />
                  )}
                  {f.hint && <p className="hint">{f.hint}</p>}
                </div>
              ))}
            </div>
            {sec.title === "Página inicial" && (
              <div>
                <label className="label" htmlFor="heroImageFile">Imagem de fundo da página inicial</label>
                <input id="heroImageFile" name="heroImageFile" type="file" accept="image/*" className="input" />
                {s["home.heroImage"] && <p className="hint">Atual: {s["home.heroImage"]} — para remover, apague o campo abaixo.</p>}
                <input name="home.heroImage" defaultValue={s["home.heroImage"]} className="input mt-2" aria-label="URL da imagem de fundo" />
              </div>
            )}
            {sec.title === "Servidor Palmas TO" && (
              <div>
                <label className="label" htmlFor="serverImageFile">Imagem principal da página do servidor</label>
                <input id="serverImageFile" name="serverImageFile" type="file" accept="image/*" className="input" />
                <input name="server.heroImage" defaultValue={s["server.heroImage"]} className="input mt-2" aria-label="URL da imagem do servidor" />
              </div>
            )}
          </fieldset>
        ))}
        <div className="sticky bottom-0 flex justify-end border-t border-line bg-bg/95 py-3 backdrop-blur">
          <SubmitButton>Salvar configurações</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
