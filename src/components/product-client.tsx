"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { toggleFavoriteAction } from "@/app/actions/product";

export function Gallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const cur = images[Math.min(idx, images.length - 1)];
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-surface-3">
        <Image src={cur.url} alt={cur.alt || `${title} — imagem ${idx + 1}`} fill sizes="(max-width: 1024px) 100vw, 800px" className="object-cover" priority />
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Imagem anterior" onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80">
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" aria-label="Próxima imagem" onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80">
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Miniaturas">
          {images.map((im, i) => (
            <button
              key={im.url + i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Ver imagem ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 ${i === idx ? "border-sun" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={im.url} alt="" fill sizes="112px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FavoriteButton({ productId, initial, loggedIn, count }: { productId: string; initial: boolean; loggedIn: boolean; count: number }) {
  const [fav, setFav] = useState(initial);
  const [n, setN] = useState(count);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className={`btn-secondary w-full ${fav ? "border-sun/50 text-sun" : ""}`}
        aria-pressed={fav}
        disabled={pending}
        onClick={() => {
          if (!loggedIn) return router.push(`/entrar?next=${encodeURIComponent(location.pathname)}`);
          setErr(null);
          start(async () => {
            const r = await toggleFavoriteAction(productId);
            if (r.ok) {
              setFav(Boolean(r.favorited));
              setN((x) => x + (r.favorited ? 1 : -1));
            } else setErr(r.error === "login" ? "Entre para favoritar." : r.error ?? "Erro.");
          });
        }}
      >
        {pending ? <Icon name="spinner" className="h-4 w-4" /> : <Icon name="heart" className="h-4 w-4" />}
        {fav ? "Favoritado" : "Favoritar"} <span className="text-muted">({n})</span>
      </button>
      {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={async () => {
          const url = location.href;
          try {
            if (navigator.share) await navigator.share({ title, url });
            else {
              await navigator.clipboard.writeText(url);
              setMsg("Link copiado!");
            }
          } catch {
            /* cancelado */
          }
        }}
      >
        <Icon name="share" className="h-4 w-4" /> Compartilhar
      </button>
      {msg && <p role="status" className="mt-1 text-xs text-ok">{msg}</p>}
    </div>
  );
}

export function DownloadButton({ productId, label = "Baixar arquivo" }: { productId: string; label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  return (
    <form
      method="post"
      action={`/api/download/${productId}`}
      onSubmit={() => {
        setState("loading");
        setTimeout(() => setState("done"), 2500);
      }}
    >
      <button type="submit" className="btn-primary w-full" disabled={state === "loading"} aria-busy={state === "loading"}>
        {state === "loading" ? (
          <>
            <Icon name="spinner" className="h-4 w-4" /> Preparando download...
          </>
        ) : state === "done" ? (
          <>
            <Icon name="check" className="h-4 w-4" /> Download iniciado — baixar novamente
          </>
        ) : (
          <>
            <Icon name="download" className="h-4 w-4" /> {label}
          </>
        )}
      </button>
    </form>
  );
}
