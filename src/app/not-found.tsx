import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-pto flex flex-col items-center py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-sun">404</p>
      <h1 className="mt-3 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço pode ter mudado ou o conteúdo foi removido.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary">Voltar ao início</Link>
        <Link href="/mods" className="btn-secondary">Ver mods</Link>
      </div>
    </div>
  );
}
