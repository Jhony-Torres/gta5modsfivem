import { CatalogView } from "@/components/catalog-view";
import type { CatalogParams } from "@/lib/catalog";

export const metadata = { title: "Mods e scripts", description: "Pesquise mods, scripts, mapas, veículos e recursos para FiveM." };
export const dynamic = "force-dynamic";

export default async function ModsPage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  return (
    <CatalogView
      basePath="/mods"
      params={await searchParams}
      eyebrow="Catálogo"
      title="Mods e scripts"
      subtitle="Veículos, mapas, scripts, interfaces, roupas e ferramentas para o seu servidor FiveM — gratuitos e pagos."
    />
  );
}
