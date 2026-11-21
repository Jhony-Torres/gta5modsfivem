import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { SocialButtons } from "@/components/server-bits";

export const metadata = { title: "Comunidade" };

const LINKS = [
  ["/noticias", "news", "Notícias e atualizações", "O que mudou na cidade e no site."],
  ["/eventos", "calendar", "Eventos", "Encontros, corridas, ações e eventos da cidade."],
  ["/tutoriais", "book", "Tutoriais", "Guias de instalação e configuração."],
  ["/faq", "help", "Perguntas frequentes", "Respostas rápidas para dúvidas comuns."],
  ["/sugerir", "plus", "Sugerir conteúdo", "Indique um mod ou recurso para análise da equipe."],
  ["/contato", "info", "Contato e suporte", "Fale com a equipe responsável."],
] as const;

export default function CommunityPage() {
  return (
    <>
      <PageHeader eyebrow="Palmas TO" title="Comunidade" subtitle="Participe pelo Discord, acompanhe o Instagram e fique por dentro das novidades.">
        <div className="flex flex-wrap gap-3"><SocialButtons /></div>
      </PageHeader>
      <div className="container-pto mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(([href, icon, title, text]) => (
          <Link key={href} href={href} className="card group p-5 hover:border-sun/50">
            <Icon name={icon} className="h-6 w-6 text-sun" />
            <h2 className="mt-3 font-semibold group-hover:text-sun">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
