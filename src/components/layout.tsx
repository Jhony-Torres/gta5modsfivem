import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { safeUrl } from "@/lib/misc";
import { Icon, Logo } from "./icons";
import { CartBadge } from "./cart";
import { MobileMenu, UserMenu } from "./nav-client";
import { logoutAction } from "@/app/actions/auth";

export const NAV = [
  { href: "/", label: "Início" },
  { href: "/servidor", label: "Nosso servidor" },
  { href: "/como-jogar", label: "Como jogar" },
  { href: "/mods", label: "Mods e scripts" },
  { href: "/gratis", label: "Gratuitos" },
  { href: "/loja", label: "Loja" },
  { href: "/tutoriais", label: "Tutoriais" },
  { href: "/comunidade", label: "Comunidade" },
];

export function SearchForm({ defaultValue = "", big = false }: { defaultValue?: string; big?: boolean }) {
  return (
    <form action="/mods" role="search" className="relative w-full">
      <label htmlFor={big ? "busca-hero" : "busca-topo"} className="sr-only">
        Pesquisar mods e scripts
      </label>
      <Icon name="search" className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted ${big ? "h-5 w-5" : "h-4 w-4"}`} />
      <input
        id={big ? "busca-hero" : "busca-topo"}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Pesquisar mods, scripts, mapas, veículos..."
        className={`input ${big ? "h-14 rounded-2xl pl-11 pr-28 text-base" : "h-10 pl-10"}`}
        maxLength={100}
      />
      {big && (
        <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2">
          Buscar
        </button>
      )}
    </form>
  );
}

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/90 backdrop-blur">
      <div className="container-pto flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Palmas TO — página inicial">
          <Logo />
          <span className="hidden font-display text-lg font-extrabold tracking-tight sm:block">
            Palmas <span className="text-sun">TO</span>
          </span>
        </Link>
        <div className="mx-2 hidden max-w-md flex-1 md:block">
          <SearchForm />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <CartBadge />
          {user ? (
            <UserMenu name={user.name} isAdmin={user.role === "ADMIN"} logout={logoutAction} />
          ) : (
            <Link href="/entrar" className="btn-secondary hidden sm:inline-flex">
              Entrar / Criar conta
            </Link>
          )}
          <MobileMenu nav={NAV} loggedIn={Boolean(user)} />
        </div>
      </div>
      <nav aria-label="Principal" className="hidden border-t border-line/50 lg:block">
        <ul className="container-pto flex h-11 items-center gap-1 text-sm">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-text">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export async function Footer() {
  const s = await getSettings();
  const discord = safeUrl(s["social.discord"]);
  const instagram = safeUrl(s["social.instagram"]);
  const youtube = safeUrl(s["social.youtube"]);
  return (
    <footer className="mt-20 border-t border-line bg-surface/50">
      <div className="container-pto grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-extrabold">
              Palmas <span className="text-sun">TO</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-muted">{s["site.tagline"]}</p>
          <div className="mt-4 flex gap-2">
            {discord && (
              <a href={discord} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3" aria-label="Discord da comunidade">
                <Icon name="discord" />
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3" aria-label="Instagram">
                <Icon name="instagram" />
              </a>
            )}
            {youtube && (
              <a href={youtube} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3" aria-label="YouTube">
                <Icon name="youtube" />
              </a>
            )}
          </div>
        </div>
        <FooterCol
          title="Servidor"
          links={[
            ["/servidor", "Nosso servidor"],
            ["/como-jogar", "Como jogar"],
            ["/regras", "Regras"],
            ["/noticias", "Novidades"],
            ["/eventos", "Eventos"],
            ["/faq", "Perguntas frequentes"],
          ]}
        />
        <FooterCol
          title="Mods e loja"
          links={[
            ["/mods", "Catálogo"],
            ["/gratis", "Downloads gratuitos"],
            ["/loja", "Loja"],
            ["/tutoriais", "Tutoriais"],
            ["/sugerir", "Sugerir conteúdo"],
            ["/conta", "Minha conta"],
          ]}
        />
        <FooterCol
          title="Legal e suporte"
          links={[
            ["/contato", "Contato e suporte"],
            ["/legal/termos", "Termos de uso"],
            ["/legal/privacidade", "Política de privacidade"],
            ["/legal/reembolso", "Compras e reembolso"],
            ["/legal/licenca", "Licença dos produtos"],
            ["/legal/remocao", "Direitos autorais e remoção"],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="container-pto space-y-2 py-6 text-xs leading-relaxed text-muted">
          <p>
            O servidor Palmas TO e este site são projetos independentes da comunidade. Não são aprovados, patrocinados ou endossados pela
            Rockstar Games, Take-Two Interactive ou Cfx.re. Grand Theft Auto, GTA V e FiveM são marcas de seus respectivos proprietários.
          </p>
          <p>
            © {new Date().getFullYear()} {s["site.name"]}. Responsável: {s["contact.responsible"] || "—"}.
            {s["contact.email"] ? (
              <>
                {" "}
                Contato: <a className="underline" href={`mailto:${s["contact.email"]}`}>{s["contact.email"]}</a>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-muted hover:text-sun">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
