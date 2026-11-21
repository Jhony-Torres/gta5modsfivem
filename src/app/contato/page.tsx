import { ContentPage } from "@/components/content-page";
import { getSettings } from "@/lib/settings";
import { safeUrl } from "@/lib/misc";
import { Icon } from "@/components/icons";

export const metadata = { title: "Contato e suporte" };
export const dynamic = "force-dynamic";

export default async function Contact() {
  const s = await getSettings();
  const discord = safeUrl(s["social.discord"]);
  const instagram = safeUrl(s["social.instagram"]);
  return (
    <ContentPage slug="contato" fallbackTitle="Contato e suporte">
      <div className="grid gap-4 sm:grid-cols-2">
        {discord && (
          <a href={discord} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-5 hover:border-sun/50">
            <Icon name="discord" className="h-6 w-6 text-sun" />
            <span><strong className="block">Discord</strong><span className="text-sm text-muted">Suporte e comunidade</span></span>
          </a>
        )}
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-5 hover:border-sun/50">
            <Icon name="instagram" className="h-6 w-6 text-sun" />
            <span><strong className="block">Instagram</strong><span className="text-sm text-muted">Novidades e bastidores</span></span>
          </a>
        )}
        <div className="card p-5 sm:col-span-2">
          <strong className="block">E-mail</strong>
          {s["contact.email"] ? (
            <a className="text-sun underline" href={`mailto:${s["contact.email"]}`}>{s["contact.email"]}</a>
          ) : (
            <span className="text-sm text-muted">E-mail de contato ainda não configurado. Use o Discord.</span>
          )}
          <p className="mt-2 text-sm text-muted">Responsável: {s["contact.responsible"] || "—"}</p>
        </div>
      </div>
    </ContentPage>
  );
}
