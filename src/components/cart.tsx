"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "./icons";

/**
 * Carrinho guardado no navegador APENAS com os IDs dos produtos.
 * Preços e disponibilidade são sempre recalculados no servidor.
 */
const KEY = "pto_cart_v1";
type Ctx = { ids: string[]; add: (id: string) => void; remove: (id: string) => void; clear: () => void; ready: boolean };
const CartCtx = createContext<Ctx>({ ids: [], add: () => {}, remove: () => {}, clear: () => {}, ready: false });

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setIds(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setIds(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const persist = useCallback((next: string[]) => {
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);
  const add = useCallback((id: string) => persist([...new Set([...read(), id])]), [persist]);
  const remove = useCallback((id: string) => persist(read().filter((x) => x !== id)), [persist]);
  const clear = useCallback(() => persist([]), [persist]);
  return <CartCtx.Provider value={{ ids, add, remove, clear, ready }}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);

export function CartBadge() {
  const { ids, ready } = useCart();
  return (
    <a href="/carrinho" className="btn-ghost relative px-2.5" aria-label={`Carrinho (${ready ? ids.length : 0} itens)`}>
      <Icon name="cart" />
      {ready && ids.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sun px-1 text-[11px] font-bold text-sun-ink">
          {ids.length}
        </span>
      )}
    </a>
  );
}

export function AddToCartButton({ productId }: { productId: string }) {
  const { ids, add, ready } = useCart();
  const [state, setState] = useState<"idle" | "added">("idle");
  const inCart = ready && ids.includes(productId);
  if (inCart || state === "added") {
    return (
      <a href="/carrinho" className="btn-secondary w-full">
        <Icon name="check" className="h-4 w-4 text-ok" /> No carrinho — ver carrinho
      </a>
    );
  }
  return (
    <button
      type="button"
      className="btn-primary w-full"
      disabled={!ready}
      onClick={() => {
        add(productId);
        setState("added");
      }}
    >
      <Icon name="cart" className="h-4 w-4" /> Adicionar ao carrinho
    </button>
  );
}

export function ClearCartOnMount() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
