import type { Category, Product, ProductTag, Tag } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { saveProductAction } from "../actions/products";

type P = Product & { tags: (ProductTag & { tag: Tag })[] };
type Cat = Category & { children: Category[] };

const dt = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function ProductForm({ product, categories }: { product?: P; categories: Cat[] }) {
  const p = product;
  return (
    <ActionForm action={saveProductAction} className="space-y-6">
      {p && <input type="hidden" name="id" value={p.id} />}

      <Box title="Informações básicas">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título *" name="title"><input id="title" name="title" required maxLength={120} defaultValue={p?.title} className="input" /></Field>
          <Field label="Slug (endereço)" name="slug" hint="Deixe vazio para gerar a partir do título."><input id="slug" name="slug" maxLength={140} defaultValue={p?.slug} className="input" /></Field>
        </div>
        <Field label="Resumo" name="shortDescription" hint="Até 300 caracteres. Aparece no topo da página e nas buscas.">
          <input id="shortDescription" name="shortDescription" maxLength={300} defaultValue={p?.shortDescription ?? ""} className="input" />
        </Field>
        <Field label="Descrição" name="description" hint="Aceita Markdown simples: **negrito**, listas com -, títulos com #, [links](https://...).">
          <textarea id="description" name="description" rows={8} defaultValue={p?.description ?? ""} className="input font-mono text-xs" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Categoria" name="categoryId">
            <select id="categoryId" name="categoryId" defaultValue={p?.categoryId ?? ""} className="input">
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name}</option>
                  {c.children.map((s) => <option key={s.id} value={s.id}>↳ {s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Tags" name="tags" hint="Separadas por vírgula. Ex.: qbcore, viatura, hud">
            <input id="tags" name="tags" defaultValue={p?.tags.map((t) => t.tag.name).join(", ")} className="input" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Imagem de capa" name="cover" hint="JPG, PNG, WebP ou AVIF. A galeria é gerenciada abaixo, após salvar.">
            <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="input" />
          </Field>
          <Field label="Vídeo de apresentação (link)" name="videoUrl" hint="YouTube é incorporado; outros links aparecem como botão.">
            <input id="videoUrl" name="videoUrl" type="url" defaultValue={p?.videoUrl ?? ""} className="input" />
          </Field>
        </div>
        {p?.coverImage && (
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="removeCover" /> Remover capa atual</label>
        )}
      </Box>

      <Box title="Preço, venda e entrega">
        <Notice tone="info">
          Você define o preço. Produtos pagos só podem ser publicados com preço definido. Pedidos já feitos guardam o preço da época —
          alterar aqui não muda o histórico.
        </Notice>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tipo" name="pricingType">
            <select id="pricingType" name="pricingType" defaultValue={p?.pricingType ?? "FREE"} className="input">
              <option value="FREE">Gratuito</option>
              <option value="PAID">Pago</option>
            </select>
          </Field>
          <Field label="Preço (R$)" name="price" hint="Ex.: 29,90. Mínimo InfinitePay: R$ 1,00.">
            <input id="price" name="price" inputMode="decimal" defaultValue={centsToInput(p?.priceCents)} className="input" placeholder="0,00" />
          </Field>
          <Field label="Preço promocional (R$)" name="promoPrice" hint="Opcional. Deve ser menor que o preço.">
            <input id="promoPrice" name="promoPrice" inputMode="decimal" defaultValue={centsToInput(p?.promoPriceCents)} className="input" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Promoção termina em" name="promoEndsAt" hint="Vazio = sem data de término.">
            <input id="promoEndsAt" name="promoEndsAt" type="datetime-local" defaultValue={dt(p?.promoEndsAt)} className="input" />
          </Field>
          <Field label="Como é vendido / distribuído" name="checkoutType">
            <select id="checkoutType" name="checkoutType" defaultValue={p?.checkoutType ?? "NONE"} className="input">
              <option value="NONE">Download gratuito no site</option>
              <option value="INFINITEPAY">Checkout InfinitePay (neste site)</option>
              <option value="TEBEX">Tebex (link externo)</option>
              <option value="CFX_MARKETPLACE">Cfx Marketplace (link externo)</option>
              <option value="EXTERNAL_LINK">Outro link externo</option>
            </select>
          </Field>
          <Field label="Entrega (produto pago)" name="deliveryType">
            <select id="deliveryType" name="deliveryType" defaultValue={p?.deliveryType ?? "SITE_FILE"} className="input">
              <option value="SITE_FILE">Arquivo privado neste site</option>
              <option value="EXTERNAL">Pela plataforma externa (Tebex/Escrow)</option>
              <option value="MANUAL">Manual pela equipe</option>
            </select>
          </Field>
        </div>
        <Field label="Link externo" name="externalUrl" hint="Obrigatório para Tebex, Cfx Marketplace ou link externo. Também pode ser usado para download gratuito hospedado fora.">
          <input id="externalUrl" name="externalUrl" type="url" defaultValue={p?.externalUrl ?? ""} className="input" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requireLogin" defaultChecked={p?.requireLogin} /> Exigir conta para baixar (apenas gratuitos)</label>
      </Box>

      <Box title="Conformidade (obrigatório para vender pela InfinitePay)">
        <Notice tone="warn" title="Verifique antes de vender">
          As regras da Cfx.re informam que a monetização de servidores FiveM (vantagens, itens, VIP no jogo) deve usar a Tebex. Recursos protegidos pelo
          Asset Escrow são entregues pela Cfx/Tebex, não por este site. Confirme que o conteúdo é seu (ou autorizado), que não reutiliza marcas/arquivos de
          terceiros sem licença e que a venda direta é permitida pelas regras atuais antes de marcar como revisado.
        </Notice>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Situação da revisão" name="complianceStatus">
            <select id="complianceStatus" name="complianceStatus" defaultValue={p?.complianceStatus ?? "NOT_REVIEWED"} className="input">
              <option value="NOT_REVIEWED">Não revisado</option>
              <option value="REVIEWED_OK">Revisado — venda direta permitida</option>
              <option value="BLOCKED">Bloqueado — não vender</option>
            </select>
          </Field>
          <Field label="Anotações da revisão" name="complianceNotes">
            <textarea id="complianceNotes" name="complianceNotes" rows={2} defaultValue={p?.complianceNotes ?? ""} className="input" />
          </Field>
        </div>
      </Box>

      <Box title="Autor, créditos e licença">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Autor" name="authorName"><input id="authorName" name="authorName" maxLength={120} defaultValue={p?.authorName ?? ""} className="input" /></Field>
          <Field label="Nome da licença" name="licenseName" hint="Ex.: Uso em um servidor, sem revenda."><input id="licenseName" name="licenseName" maxLength={120} defaultValue={p?.licenseName ?? ""} className="input" /></Field>
        </div>
        <Field label="Termos da licença / condições de uso" name="licenseText"><textarea id="licenseText" name="licenseText" rows={4} defaultValue={p?.licenseText ?? ""} className="input" /></Field>
        <Field label="Créditos" name="credits"><textarea id="credits" name="credits" rows={2} defaultValue={p?.credits ?? ""} className="input" /></Field>
      </Box>

      <Box title="Compatibilidade e instalação">
        <p className="text-xs text-muted">Preencha somente o que foi verificado. Campos vazios aparecem como “não informado” no site.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Compatibilidade" name="compatibility" hint="Ex.: FiveM"><input id="compatibility" name="compatibility" defaultValue={p?.compatibility ?? ""} className="input" /></Field>
          <Field label="Frameworks" name="frameworks" hint="Separados por vírgula. Ex.: QBCore, ESX"><input id="frameworks" name="frameworks" defaultValue={p?.frameworks ?? ""} className="input" /></Field>
          <Field label="Versão do jogo / build" name="gameBuild" hint="Ex.: b3095"><input id="gameBuild" name="gameBuild" defaultValue={p?.gameBuild ?? ""} className="input" /></Field>
        </div>
        <Field label="Requisitos" name="requirements"><textarea id="requirements" name="requirements" rows={3} defaultValue={p?.requirements ?? ""} className="input" /></Field>
        <Field label="Dependências" name="dependencies"><textarea id="dependencies" name="dependencies" rows={3} defaultValue={p?.dependencies ?? ""} className="input" /></Field>
        <Field label="Instruções de instalação" name="installation"><textarea id="installation" name="installation" rows={6} defaultValue={p?.installation ?? ""} className="input font-mono text-xs" /></Field>
      </Box>

      <Box title="Publicação e destaque">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Status" name="status">
            <select id="status" name="status" defaultValue={p?.status ?? "DRAFT"} className="input">
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="UNPUBLISHED">Despublicado</option>
            </select>
          </Field>
          <Field label="Ordem no destaque" name="featuredOrder"><input id="featuredOrder" name="featuredOrder" type="number" defaultValue={p?.featuredOrder ?? 0} className="input" /></Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="featured" defaultChecked={p?.featured} /> Destacar na página inicial</label>
        </div>
      </Box>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
        <SubmitButton pendingText="Salvando produto...">{p ? "Salvar alterações" : "Criar produto"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card space-y-4 p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="font-semibold">{title}</h2>
      {children}
    </fieldset>
  );
}
