import { CatalogView } from "@/components/catalog-view";
import type { CatalogParams } from "@/lib/catalog";

export const metadata = { title: "Downloads gratuitos" };
export const dynamic = "force-dynamic";

export default async function FreePage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  return (
    <CatalogView
      basePath="/gratis"
      fixedPrice="gratis"
      params={await searchParams}
      eyebrow="Downloads gratuitos"
      title="Downloads gratuitos"
      subtitle="Arquivos liberados para download sem custo. Na maioria dos casos você não precisa criar conta."
    />
  );
}
