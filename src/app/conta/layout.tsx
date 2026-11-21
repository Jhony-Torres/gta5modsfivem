import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/conta", "user", "Meus dados"],
  ["/conta/produtos", "box", "Meus produtos"],
  ["/conta/pedidos", "cart", "Pedidos"],
  ["/conta/downloads", "download", "Downloads"],
  ["/conta/favoritos", "heart", "Favoritos"],
] as const;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-pto py-8">
      <h1 className="font-display text-2xl font-bold">Olá, {user.name.split(" ")[0]}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Minha conta" className="flex gap-1 overflow-x-auto lg:flex-col">
          {LINKS.map(([href, icon, label]) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
              <Icon name={icon} className="h-4 w-4" /> {label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-sun hover:bg-surface-2">
              <Icon name="settings" className="h-4 w-4" /> Painel admin
            </Link>
          )}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
