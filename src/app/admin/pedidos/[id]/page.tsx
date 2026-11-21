import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { formatDate, safeUrl } from "@/lib/misc";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice, OrderStatusBadge } from "@/components/ui";
import { adminCheckPaymentAction, adminSetOrderStatusAction } from "../../actions/orders";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "desc" } }, entitlements: { include: { product: { select: { title: true } } } }, user: { select: { id: true, email: true, name: true } } },
  });
  if (!o) notFound();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Pedido {o.code}</h1>
        <OrderStatusBadge status={o.status} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card space-y-2 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Dados</h2>
          <Row k="Cliente" v={`${o.customerName} <${o.customerEmail}>`} />
          <Row k="Conta atual" v={o.user.email} />
          <Row k="Criado" v={formatDate(o.createdAt, true)} />
          <Row k="Validade do link" v={formatDate(o.expiresAt, true)} />
          <Row k="Pago em" v={formatDate(o.paidAt, true)} />
          <Row k="Total do pedido" v={formatBRL(o.totalCents)} />
          <Row k="Valor pago (InfinitePay)" v={o.paidAmountCents != null ? formatBRL(o.paidAmountCents) : "—"} />
          <Row k="Meio / parcelas" v={[o.captureMethod, o.installments ? `${o.installments}x` : null].filter(Boolean).join(" · ") || "—"} />
          <Row k="order_nsu" v={o.code} mono />
          <Row k="transaction_nsu" v={o.transactionNsu ?? "—"} mono />
          <Row k="slug (fatura)" v={o.invoiceSlug ?? "—"} mono />
          {safeUrl(o.receiptUrl) && <a href={safeUrl(o.receiptUrl)!} target="_blank" rel="noopener noreferrer" className="text-sun underline">Comprovante</a>}
          {o.adminNotes && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{o.adminNotes}</pre>}
        </div>
        <div className="card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Itens (preço registrado na compra)</h2>
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                {i.productId ? <Link href={`/admin/produtos/${i.productId}`} className="hover:text-sun">{i.titleSnapshot}</Link> : i.titleSnapshot}
                <span>{formatBRL(i.unitPriceCents)}</span>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 mt-5 font-semibold">Acessos liberados</h2>
          {o.entitlements.length === 0 ? <p className="text-muted">Nenhum.</p> : (
            <ul className="space-y-1">
              {o.entitlements.map((e) => <li key={e.id}>{e.product.title} {e.revokedAt ? <span className="text-bad">(revogado em {formatDate(e.revokedAt)})</span> : <span className="text-ok">(ativo)</span>}</li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Verificar pagamento na InfinitePay</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Use os dados que aparecem na venda dentro do app/Conta Web InfinitePay. O sistema consulta o payment_check oficial e só libera se confirmado.</p>
          <ActionForm action={adminCheckPaymentAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <Field label="transaction_nsu" name="transactionNsu"><input id="transactionNsu" name="transactionNsu" defaultValue={o.transactionNsu ?? ""} className="input font-mono text-xs" /></Field>
            <Field label="slug (código da fatura)" name="slug"><input id="slug" name="slug" defaultValue={o.invoiceSlug ?? ""} className="input font-mono text-xs" /></Field>
            <SubmitButton pendingText="Consultando...">Consultar e conciliar</SubmitButton>
          </ActionForm>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Atualizar status manualmente</h2>
          <div className="my-3"><Notice tone="warn">Estornos e cancelamentos são feitos no app InfinitePay. Registre aqui depois de conferir lá. Estorno/cancelamento revogam o acesso aos produtos.</Notice></div>
          <ActionForm action={adminSetOrderStatusAction} confirmText="Confirmar alteração do status do pedido?">
            <input type="hidden" name="orderId" value={o.id} />
            <Field label="Novo status" name="status">
              <select id="status" name="status" className="input">
                <option value="REFUNDED">Estornado</option>
                <option value="CANCELED">Cancelado</option>
                <option value="NEEDS_REVIEW">Em análise</option>
                <option value="PENDING">Pendente</option>
              </select>
            </Field>
            <Field label="Motivo / referência *" name="note"><textarea id="note" name="note" required rows={2} className="input" /></Field>
            <SubmitButton className="btn-danger">Aplicar</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Eventos de pagamento ({o.events.length})</h2>
        {o.events.length === 0 ? <p className="text-sm text-muted">Nenhum evento.</p> : (
          <ul className="space-y-2">
            {o.events.map((e) => (
              <li key={e.id} className="rounded-xl bg-surface-2 p-3 text-xs">
                <p><strong>{e.outcome}</strong> · {e.source} · {formatDate(e.createdAt, true)}</p>
                {e.error && <p className="mt-1 text-bad">{e.error}</p>}
                {e.payload && <details className="mt-1"><summary className="cursor-pointer text-muted">payload</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all">{e.payload}</pre></details>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`text-right ${mono ? "break-all font-mono text-xs" : ""}`}>{v}</span>
    </div>
  );
}
