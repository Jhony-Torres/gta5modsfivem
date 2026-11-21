import Image from "next/image";
import Link from "next/link";
import React from "react";
import type { CardProduct } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { effectivePriceCents, isPromoActive } from "@/lib/pricing";
import { formatDate } from "@/lib/misc";
import { Icon } from "./icons";

export function PageHeader({ title, subtitle, children, eyebrow }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="border-b border-line/60 hero-glow">
      <div className="container-pto py-10 sm:py-14">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sun">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-muted">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "box", title, text, action }: { icon?: string; title: string; text?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-2xl bg-surface-3 p-3 text-muted">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "warn" | "bad" | "ok"; children: React.ReactNode; title?: string }) {
  const styles = {
    info: "border-river/40 bg-river/10 text-river",
    warn: "border-warn/40 bg-warn/10 text-warn",
    bad: "border-bad/40 bg-bad/10 text-bad",
    ok: "border-ok/40 bg-ok/10 text-ok",
  }[tone];
  const icon = { info: "info", warn: "alert", bad: "alert", ok: "check" }[tone];
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-text/90">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Nota ${value.toFixed(1).replace(".", ",")} de 5${count != null ? `, ${count} avaliações` : ""}`}>
      <span className="flex text-sun" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={i <= rounded ? "currentColor" : i - 0.5 === rounded ? "url(#half)" : "none"} stroke="currentColor" strokeWidth="2">
            <defs>
              <linearGradient id="half">
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
          </svg>
        ))}
      </span>
      {count != null && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

export function PriceTag({ p, size = "sm" }: { p: Pick<CardProduct, "pricingType" | "priceCents" | "promoPriceCents" | "promoEndsAt">; size?: "sm" | "lg" }) {
  if (p.pricingType === "FREE") {
    return <span className={`font-bold text-ok ${size === "lg" ? "text-2xl" : "text-sm"}`}>Gratuito</span>;
  }
  const price = effectivePriceCents(p);
  if (price == null) return <span className="text-sm text-muted">Preço a definir</span>;
  const promo = isPromoActive(p);
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-bold text-sun ${size === "lg" ? "text-3xl" : "text-sm"}`}>{formatBRL(price)}</span>
      {promo && <s className={`text-muted ${size === "lg" ? "text-base" : "text-xs"}`}>{formatBRL(p.priceCents)}</s>}
    </span>
  );
}

export function Thumb({ src, alt, className = "", sizes = "(max-width: 640px) 100vw, 300px", priority = false }: { src: string | null; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2 text-muted ${className}`} aria-hidden="true">
        <Icon name="box" className="h-8 w-8 opacity-50" />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-surface-3 ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} />
    </div>
  );
}

export function ProductCard({ p }: { p: CardProduct }) {
  const external = p.checkoutType === "TEBEX" || p.checkoutType === "CFX_MARKETPLACE" || p.checkoutType === "EXTERNAL_LINK";
  return (
    <article className="card group relative flex flex-col overflow-hidden transition-colors hover:border-sun/50">
      <Thumb src={p.coverImage} alt="" className="aspect-video" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.category && <span className="chip">{p.category.name}</span>}
          {external && <span className="chip">Venda externa</span>}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-snug">
          <Link href={`/mods/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:text-sun">
            {p.title}
          </Link>
        </h3>
        {p.authorName && <p className="text-xs text-muted">por {p.authorName}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceTag p={p} />
          <div className="flex items-center gap-3 text-xs text-muted">
            {p.ratingCount > 0 && <Stars value={p.ratingAvg} count={p.ratingCount} />}
            {p.pricingType === "FREE" && (
              <span className="inline-flex items-center gap-1" title="Downloads registrados">
                <Icon name="download" className="h-3.5 w-3.5" />
                {p.downloadCount.toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted/80">Atualizado em {formatDate(p.contentUpdatedAt)}</p>
      </div>
    </article>
  );
}

export function ProductGrid({ items, empty }: { items: CardProduct[]; empty?: React.ReactNode }) {
  if (items.length === 0) return <>{empty ?? <EmptyState title="Nada por aqui ainda" text="Assim que houver conteúdo publicado, ele aparecerá nesta seção." />}</>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}

export function Section({ title, href, linkLabel = "Ver todos", children, id }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="container-pto mt-14" aria-labelledby={id}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-sm font-medium text-sun hover:underline">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link className="btn-secondary px-3" href={makeHref(page - 1)} rel="prev">
          Anterior
        </Link>
      )}
      {nums.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link className={n === page ? "btn-primary px-3.5" : "btn-secondary px-3.5"} href={makeHref(n)} aria-current={n === page ? "page" : undefined}>
            {n}
          </Link>
        </React.Fragment>
      ))}
      {page < pages && (
        <Link className="btn-secondary px-3" href={makeHref(page + 1)} rel="next">
          Próxima
        </Link>
      )}
    </nav>
  );
}

export const ORDER_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Aguardando pagamento", tone: "text-warn border-warn/40 bg-warn/10" },
  PAID: { label: "Pago", tone: "text-ok border-ok/40 bg-ok/10" },
  FAILED: { label: "Falhou", tone: "text-bad border-bad/40 bg-bad/10" },
  CANCELED: { label: "Cancelado", tone: "text-muted border-line bg-surface-2" },
  EXPIRED: { label: "Expirado", tone: "text-muted border-line bg-surface-2" },
  REFUNDED: { label: "Estornado", tone: "text-bad border-bad/40 bg-bad/10" },
  NEEDS_REVIEW: { label: "Em análise", tone: "text-warn border-warn/40 bg-warn/10" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS_LABEL[status] ?? { label: status, tone: "text-muted border-line" };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>;
}
