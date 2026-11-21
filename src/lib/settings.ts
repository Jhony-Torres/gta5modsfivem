import { prisma } from "./db";

/**
 * Configurações editáveis no painel (/admin/configuracoes).
 * Valores vazios = ainda não configurado. Nada aqui deve ser inventado.
 */
export const SETTING_DEFAULTS = {
  "site.name": "Palmas TO",
  "site.tagline": "Comunidade de roleplay e central de mods e scripts para FiveM",
  "home.heroTitle": "Palmas TO",
  "home.heroText":
    "Uma cidade de roleplay inspirada em Palmas, Tocantins, e uma central de mods, scripts e recursos para quem cria no FiveM.",
  "home.serverCardText": "Conheça a cidade, veja como entrar e participe da comunidade.",
  "home.modsCardText": "Pesquise, baixe e compre mods, scripts, mapas e recursos para o seu servidor.",
  "home.heroImage": "",
  "social.discord": "https://discord.gg/pkfNgjjvA",
  "social.instagram": "https://www.instagram.com/jhony_torres_ofc/",
  "social.youtube": "",
  "social.tiktok": "",
  "contact.responsible": "Jhony",
  "contact.email": "",
  "contact.whatsapp": "",
  "legal.entityName": "",
  "legal.document": "",
  "legal.city": "",
  "server.intro": "",
  "server.connectUrl": "",
  "server.address": "",
  "server.cfxCode": "",
  "server.statusMode": "none", // none | cfx | direct
  "server.statusEndpoint": "",
  "server.heroImage": "",
  "server.videoUrl": "",
  "store.notice": "",
  "downloads.requireLoginDefault": "false",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const out = { ...SETTING_DEFAULTS } as Settings;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export async function saveSettings(values: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: value ?? "" }, create: { key, value: value ?? "" } }),
    ),
  );
}

/** Lista o que ainda falta configurar — exibido no painel. */
export function missingSettings(s: Settings): string[] {
  const missing: string[] = [];
  if (!s["contact.email"]) missing.push("E-mail de contato do responsável");
  if (!s["legal.entityName"]) missing.push("Nome/razão social do responsável pelas vendas (páginas legais)");
  if (!s["legal.document"]) missing.push("CPF/CNPJ exibido nas páginas legais (se aplicável)");
  if (!s["server.connectUrl"] && !s["server.address"] && !s["server.cfxCode"])
    missing.push("Endereço/link de conexão do servidor Palmas TO");
  if (s["server.statusMode"] === "none") missing.push("Fonte de status do servidor (opcional)");
  if (!s["server.intro"]) missing.push("Texto de apresentação do servidor");
  return missing;
}
