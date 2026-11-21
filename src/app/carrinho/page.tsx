import { PageHeader } from "@/components/ui";
import { CartView } from "./cart-view";

export const metadata = { title: "Carrinho" };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Carrinho" subtitle="Os preços são sempre conferidos no servidor antes do pagamento." />
      <div className="container-pto mt-8">
        <CartView />
      </div>
    </>
  );
}
