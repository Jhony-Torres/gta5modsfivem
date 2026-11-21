"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart";
import { Icon } from "@/components/icons";
import { formatBRL } from "@/lib/money";

type Item = { id: string; slug: string; title: string; coverImage: string | null; priceCents: number | null; originalPriceCents: number | null; problem: string | null };
type Quote = { items: Item[]; totalCents: number; missing: string[]; loggedIn: boolean };

export function CartView() {
  const { ids, remove, ready } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (ids.length === 0) {
      setQuote(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetch("/api/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((q: Quote) => {
        if (!alive) return;
        q.missing.forEach((m) => remove(m));
        setQuote(q);
      })
      .catch(() => alive && setError("Não foi possível carregar o carrinho. Tente recarregar a página."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ids, ready, remove]);

  if (!ready || loading) {
    return (
      <div className="card flex items-center gap-3 p-6 text-muted" role="status">
        <Icon name="spinner" className="h-5 w-5" /> Carregando carrinho...
      </div>
    );
  }
  if (error) return <div role="alert" className="card p-6 text-bad">{error}</div>;
  if (!quote || quote.items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <Icon name="cart" className="h-8 w-8 text-muted" />
        <p className="font-semibold">Seu carrinho está vazio</p>
        <Link href="/loja" className="btn-primary">Ver a loja</Link>
      </div>
    );
  }
  const valid = quote.items.filter((i) => !i.problem);
  const checkoutHref = `/checkout?ids=${valid.map((i) => i.id).join(",")}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-3" aria-label="Itens do carrinho">
        {quote.items.map((i) => (
          <li key={i.id} className="card flex items-center gap-4 p-4">
            <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-3">
              {i.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/mods/${i.slug}`} className="font-semibold hover:text-sun">{i.title}</Link>
              {i.problem ? (
                <p className="mt-1 text-sm text-warn">{i.problem}</p>
              ) : (
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-sun">{formatBRL(i.priceCents)}</span>
                  {i.originalPriceCents != null && i.priceCents != null && i.priceCents < i.originalPriceCents && (
                    <s className="ml-2 text-xs text-muted">{formatBRL(i.originalPriceCents)}</s>
                  )}
                </p>
              )}
            </div>
            <button type="button" className="btn-ghost px-2.5" onClick={() => remove(i.id)} aria-label={`Remover ${i.title}`}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="card h-fit space-y-4 p-5">
        <h2 className="font-semibold">Resumo</h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted">{valid.length} {valid.length === 1 ? "item" : "itens"}</span>
          <span>{formatBRL(quote.totalCents)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>Total</span>
          <span className="text-sun">{formatBRL(quote.totalCents)}</span>
        </div>
        {valid.length === 0 ? (
          <p className="text-sm text-muted">Remova os itens indisponíveis para continuar.</p>
        ) : quote.loggedIn ? (
          <Link href={checkoutHref} className="btn-primary w-full">Revisar e pagar</Link>
        ) : (
          <Link href={`/entrar?next=${encodeURIComponent(checkoutHref)}`} className="btn-primary w-full">Entrar para continuar</Link>
        )}
        <p className="text-xs text-muted">O pagamento é feito na página oficial da InfinitePay (Pix ou cartão).</p>
      </div>
    </div>
  );
}
