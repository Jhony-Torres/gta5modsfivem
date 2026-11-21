"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export function MobileMenu({ nav, loggedIn }: { nav: { href: string; label: string }[]; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="btn-ghost px-2.5 lg:hidden"
        aria-label="Abrir menu"
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div id="menu-mobile" className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">Menu</span>
              <button type="button" className="btn-ghost px-2.5" aria-label="Fechar menu" onClick={() => setOpen(false)} autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <form action="/mods" role="search">
              <label htmlFor="busca-mobile" className="sr-only">
                Pesquisar
              </label>
              <input id="busca-mobile" name="q" type="search" className="input" placeholder="Pesquisar mods e scripts" />
            </form>
            <nav aria-label="Menu móvel">
              <ul className="space-y-1">
                {nav.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`block rounded-xl px-3 py-2.5 ${pathname === n.href ? "bg-surface-3 text-sun" : "text-text hover:bg-surface-2"}`}
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {!loggedIn && (
              <Link href="/entrar" className="btn-primary mt-auto">
                Entrar / Criar conta
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function UserMenu({ name, isAdmin, logout }: { name: string; isAdmin: boolean; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const first = name.split(" ")[0];
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-secondary px-3" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="user" className="h-4 w-4" />
        <span className="hidden max-w-28 truncate sm:inline">{first}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface-2 p-1.5 shadow-2xl">
          {isAdmin && <MenuLink href="/admin" icon="settings" label="Painel administrativo" />}
          <MenuLink href="/conta" icon="user" label="Minha conta" />
          <MenuLink href="/conta/produtos" icon="box" label="Meus produtos" />
          <MenuLink href="/conta/pedidos" icon="cart" label="Meus pedidos" />
          <MenuLink href="/conta/downloads" icon="download" label="Meus downloads" />
          <MenuLink href="/conta/favoritos" icon="heart" label="Favoritos" />
          <form action={logout}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-bad hover:bg-surface-3">
              <Icon name="logout" className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-surface-3">
      <Icon name={icon} className="h-4 w-4 text-muted" /> {label}
    </Link>
  );
}
