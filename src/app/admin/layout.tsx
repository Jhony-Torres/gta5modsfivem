import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel administrativo", robots: { index: false } };

const GROUPS: { title: string; links: [string, string, string][] }[] = [
  { title: "Geral", links: [["/admin", "layout", "Visão geral"], ["/admin/configuracoes", "settings", "Configurações"]] },
  {
    title: "Catálogo",
    links: [
      ["/admin/produtos", "box", "Produtos"],
      ["/admin/categorias", "map", "Categorias"],
      ["/admin/moderacao", "shield", "Comentários e avaliações"],
      ["/admin/sugestoes", "plus", "Sugestões"],
    ],
  },
  { title: "Vendas", links: [["/admin/pedidos", "cart", "Pedidos e pagamentos"], ["/admin/usuarios", "users", "Usuários"]] },
  {
    title: "Comunidade",
    links: [
      ["/admin/servidor", "server", "Servidor (itens e galeria)"],
      ["/admin/paginas", "book", "Páginas e textos"],
      ["/admin/noticias", "news", "Notícias e tutoriais"],
      ["/admin/eventos", "calendar", "Eventos"],
      ["/admin/faq", "help", "Perguntas frequentes"],
    ],
  },
  { title: "Segurança", links: [["/admin/logs", "clock", "Registro de ações"]] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-pto py-6">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Painel" className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
              <ul className="flex gap-1 overflow-x-auto lg:flex-col">
                {g.links.map(([href, icon, label]) => (
                  <li key={href}>
                    <Link href={href} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                      <Icon name={icon} className="h-4 w-4" /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
