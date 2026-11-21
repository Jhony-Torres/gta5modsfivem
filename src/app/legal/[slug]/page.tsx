import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";

export const dynamic = "force-dynamic";

const LEGAL_PAGES: Record<string, string> = {
  termos: "Termos de uso",
  privacidade: "Política de privacidade",
  reembolso: "Política de compra e reembolso",
  licenca: "Licença e condições de uso dos produtos",
  remocao: "Direitos autorais e solicitação de remoção",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: LEGAL_PAGES[(await params).slug] ?? "Página" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_PAGES[slug]) notFound();
  return <ContentPage slug={`legal-${slug}`} eyebrow="Informações legais" fallbackTitle={LEGAL_PAGES[slug]} />;
}
