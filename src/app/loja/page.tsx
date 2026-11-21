import { CatalogView } from "@/components/catalog-view";
import type { CatalogParams } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { Notice } from "@/components/ui";

export const metadata = { title: "Loja" };
export const dynamic = "force-dynamic";

export default async function StorePage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const s = await getSettings();
  return (
    <>
      <CatalogView
        basePath="/loja"
        fixedPrice="pago"
        params={await searchParams}
        eyebrow="Loja"
        title="Loja"
        subtitle="Produtos pagos com preço em reais. Alguns itens são vendidos por plataformas externas (como Tebex ou Cfx Marketplace), indicadas na página de cada produto."
      />
      {s["store.notice"] && (
        <div className="container-pto mt-8">
          <Notice>{s["store.notice"]}</Notice>
        </div>
      )}
    </>
  );
}
