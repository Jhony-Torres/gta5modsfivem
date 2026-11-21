import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { quoteCart } from "@/lib/payments";
import { infinitePayStatus } from "@/lib/infinitepay";
import { formatBRL } from "@/lib/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/ui";
import { startCheckoutAction } from "@/app/actions/checkout";

export const metadata = { title: "Confirmar pedido" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = "" } = await searchParams;
  const user = await requireUser(`/checkout?ids=${ids}`);
  const list = ids.split(",").filter(Boolean).slice(0, 50);
  const quote = await quoteCart(list, user.id);
  const status = infinitePayStatus();
  const blocked = quote.items.some((i) => i.problem) || quote.valid.length === 0;

  return (
    <>
      <PageHeader title="Confirmar pedido" subtitle="Confira os itens e o valor. O pagamento acontece na página oficial da InfinitePay." />
      <div className="container-pto mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Itens</h2>
            {quote.items.length === 0 ? (
              <p className="text-sm text-muted">Nenhum item. <Link href="/carrinho" className="text-sun underline">Voltar ao carrinho</Link></p>
            ) : (
              <ul className="divide-y divide-line">
                {quote.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-4 py-3 text-sm">
                    <span>
                      {i.title}
                      {i.problem && <span className="block text-warn">{i.problem}</span>}
                    </span>
                    <span className="font-semibold">{i.problem ? "—" : formatBRL(i.priceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Identificação</h2>
            <p><span className="text-muted">Nome:</span> {user.name}</p>
            <p><span className="text-muted">E-mail:</span> {user.email}</p>
            <p className="mt-2 text-xs text-muted">Os produtos ficarão vinculados a esta conta. <Link href="/conta" className="text-sun underline">Alterar dados</Link></p>
          </div>
        </div>
        <div className="card h-fit space-y-4 p-5">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-sun">{formatBRL(quote.totalCents)}</span>
          </div>
          {!status.ready ? (
            <Notice tone="warn" title="Pagamentos ainda não habilitados">
              A loja ainda está em configuração. Nenhuma cobrança será criada.
            </Notice>
          ) : blocked ? (
            <Notice tone="warn">Revise o carrinho: há itens indisponíveis.</Notice>
          ) : (
            <ActionForm action={startCheckoutAction}>
              <input type="hidden" name="ids" value={quote.valid.map((v) => v.id).join(",")} />
              <input type="hidden" name="expectedTotal" value={quote.totalCents} />
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="confirm" required className="mt-1 accent-[var(--color-sun)]" />
                <span>
                  Confirmo o pedido no valor de <strong>{formatBRL(quote.totalCents)}</strong> e li a{" "}
                  <Link href="/legal/reembolso" className="text-sun underline" target="_blank">política de compra e reembolso</Link>.
                </span>
              </label>
              <SubmitButton className="btn-primary w-full" pendingText="Gerando pagamento...">
                Ir para o pagamento
              </SubmitButton>
              <p className="text-xs text-muted">
                Você será levado para a página segura da InfinitePay. A liberação acontece somente depois que a InfinitePay confirmar o pagamento.
                Não armazenamos dados de cartão.
              </p>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
