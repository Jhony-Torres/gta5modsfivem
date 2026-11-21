/**
 * Teste ponta a ponta dos fluxos principais contra o servidor em execução.
 * Usa um MOCK local da InfinitePay (nenhuma cobrança real) e dados "[TESTE]" que são apagados ao final.
 *
 * Pré-requisito: servidor rodando com
 *   INFINITEPAY_ENABLED=true INFINITEPAY_HANDLE=teste-local INFINITEPAY_API_BASE=http://127.0.0.1:4010
 * Execução: npm run test:e2e   (BASE_URL opcional, padrão http://localhost:3000)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
try {
  process.loadEnvFile(".env");
} catch {}
process.env.INFINITEPAY_ENABLED = "true";
process.env.INFINITEPAY_HANDLE ||= "teste-local";
process.env.INFINITEPAY_API_BASE = "http://127.0.0.1:4010";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { startMock } from "./mock-infinitepay";
import { createOrderAndCheckout, CheckoutError } from "../src/lib/payments";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
const TAG = "[TESTE-E2E]";
let pass = 0;
let fail = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else fail++;
  const line = `${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`;
  results.push(line);
  console.log(line);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function makeUser(email: string, role: "USER" | "ADMIN" = "USER") {
  const u = await prisma.user.create({ data: { email, name: `${TAG} ${email.split("@")[0]}`, role, passwordHash: await bcrypt.hash(crypto.randomUUID(), 4) } });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { id: sha(token), userId: u.id, expiresAt: new Date(Date.now() + 3600_000) } });
  return { user: u, cookie: `pto_session=${token}` };
}

async function makeFile(content: string, name: string) {
  const key = `products/e2e/${crypto.randomBytes(6).toString("hex")}-${name}`;
  const full = path.resolve(process.env.STORAGE_PRIVATE_DIR || "./storage/private", key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return prisma.storedFile.create({ data: { storageKey: key, originalName: name, mimeType: "application/zip", size: BigInt(Buffer.byteLength(content)), sha256: sha(content), visibility: "private" } });
}

async function makeProduct(opts: { slug: string; title: string; paid?: number; content: string }) {
  const cat = await prisma.category.findUnique({ where: { slug: "scripts" } });
  const file = await makeFile(opts.content, `${opts.slug}.zip`);
  return prisma.product.create({
    data: {
      slug: opts.slug,
      title: opts.title,
      shortDescription: `${TAG} produto de teste automatizado`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      categoryId: cat?.id,
      pricingType: opts.paid ? "PAID" : "FREE",
      priceCents: opts.paid ?? null,
      checkoutType: opts.paid ? "INFINITEPAY" : "NONE",
      complianceStatus: opts.paid ? "REVIEWED_OK" : "NOT_REVIEWED",
      deliveryType: "SITE_FILE",
      versions: { create: { version: "1.0.0", fileId: file.id, isCurrent: true } },
    },
  });
}

async function req(p: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  return fetch(BASE + p, { ...init, headers, redirect: "manual" });
}

async function download(productId: string, cookie?: string) {
  const r1 = await req(`/api/download/${productId}`, { method: "POST", cookie });
  if (r1.status !== 303) return { status: r1.status, body: await r1.text(), location: null as string | null };
  const loc = r1.headers.get("location")!;
  if (!new URL(loc).pathname.startsWith("/api/files/")) return { status: 303, body: "", location: new URL(loc).pathname };
  const r2 = await req(new URL(loc).pathname, { cookie });
  return { status: r2.status, body: await r2.text(), location: new URL(loc).pathname };
}

async function webhook(body: Record<string, unknown>) {
  const r = await req("/api/webhooks/infinitepay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const products = await prisma.product.findMany({ where: { shortDescription: { startsWith: TAG } }, include: { versions: true } });
  await prisma.paymentEvent.deleteMany({ where: { order: { userId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { userId: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
  const fileIds = products.flatMap((p) => p.versions.map((v) => v.fileId!)).filter(Boolean);
  const files = await prisma.storedFile.findMany({ where: { id: { in: fileIds } } });
  for (const f of files) fs.rmSync(path.resolve(process.env.STORAGE_PRIVATE_DIR || "./storage/private", f.storageKey), { force: true });
  await prisma.storedFile.deleteMany({ where: { id: { in: fileIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.paymentEvent.deleteMany({ where: { orderId: null, payload: { contains: "E2E-INEXISTENTE" } } });
}

async function main() {
  await cleanup();
  const mock = await startMock(4010);
  const stamp = Date.now().toString(36);
  try {
    const free = await makeProduct({ slug: `e2e-gratis-${stamp}`, title: `${TAG} Mod gratuito`, content: "FREE-FILE-CONTENT" });
    const paidA = await makeProduct({ slug: `e2e-pago-a-${stamp}`, title: `${TAG} Script pago A`, paid: 1990, content: "PAID-A-CONTENT" });
    const paidB = await makeProduct({ slug: `e2e-pago-b-${stamp}`, title: `${TAG} Script pago B`, paid: 2990, content: "PAID-B-CONTENT" });
    const b1 = await makeUser(`comprador1-${stamp}@teste.local`);
    const b2 = await makeUser(`comprador2-${stamp}@teste.local`);
    const admin = await makeUser(`admin-${stamp}@teste.local`, "ADMIN");

    // 1. Páginas públicas
    for (const p of ["/", "/mods", "/gratis", "/loja", "/servidor", "/como-jogar", "/regras", "/noticias", "/tutoriais", "/eventos", "/faq", "/comunidade", "/contato", "/carrinho", "/legal/termos", "/legal/privacidade", "/legal/reembolso", "/legal/licenca", "/legal/remocao", "/entrar", "/cadastro", "/recuperar-senha", "/sugerir", `/mods/${free.slug}`, `/mods/${paidA.slug}`]) {
      const r = await req(p);
      check(`GET ${p} responde 200`, r.status === 200, String(r.status));
    }
    const notFound = await req("/mods/nao-existe-xyz");
    check("Produto inexistente responde 404", notFound.status === 404);

    // 2. Busca e filtros (mantidos na URL)
    const search = await (await req(`/mods?q=${encodeURIComponent("Script pago A")}`)).text();
    check("Busca por nome encontra o produto", search.includes("Script pago A") && !search.includes("Mod gratuito</a>"));
    const freeOnly = await (await req(`/mods?preco=gratis&q=TESTE-E2E`)).text();
    check("Filtro gratuitos exclui pagos", freeOnly.includes("Mod gratuito") && !freeOnly.includes("Script pago A"));
    const paidOnly = await (await req(`/mods?preco=pago&ordem=menor-preco&categoria=scripts&q=TESTE-E2E`)).text();
    check("Filtros combinados (pago + categoria + ordenação)", paidOnly.includes("Script pago A") && paidOnly.includes("Script pago B") && !paidOnly.includes("Mod gratuito"));
    check("Ordenação por menor preço (A antes de B)", paidOnly.indexOf("Script pago A") < paidOnly.indexOf("Script pago B"));

    // 3. Página do produto
    const pageA = await (await req(`/mods/${paidA.slug}`)).text();
    check("Página do produto pago mostra preço em R$", pageA.includes("R$") && pageA.includes("19,90"));
    check("Compatibilidade não informada aparece como tal", pageA.includes("Não informada"));
    check("Produto pago não mostra download para visitante", !pageA.includes(`/api/download/${paidA.id}`));

    // 4. Download gratuito sem conta + estatística real
    const d1 = await download(free.id);
    check("Download gratuito sem conta funciona", d1.status === 200 && d1.body === "FREE-FILE-CONTENT", String(d1.status));
    await download(free.id);
    const freeAfter = await prisma.product.findUnique({ where: { id: free.id } });
    check("Contador real de downloads (dedupe por pessoa/hora)", freeAfter?.downloadCount === 1, String(freeAfter?.downloadCount));
    const bad = await req(`/api/files/token-invalido.abc`);
    check("Link de download adulterado é recusado", bad.status === 410);

    // 5. Carrinho com preço do servidor
    const quote = await (await req("/api/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [paidA.id, free.id] }) })).json();
    const qa = quote.items.find((i: { id: string }) => i.id === paidA.id);
    const qf = quote.items.find((i: { id: string }) => i.id === free.id);
    check("Carrinho calcula preço pelo banco", qa?.priceCents === 1990 && quote.totalCents === 1990);
    check("Produto gratuito não entra no checkout pago", Boolean(qf?.problem));

    // 6. Pedido pendente
    let mismatchBlocked = false;
    try {
      await createOrderAndCheckout({ user: b1.user, productIds: [paidA.id], expectedTotalCents: 1 });
    } catch (e) {
      mismatchBlocked = e instanceof CheckoutError;
    }
    check("Valor confirmado diferente do banco é recusado", mismatchBlocked);
    const { order: o1, checkoutUrl } = await createOrderAndCheckout({ user: b1.user, productIds: [paidA.id], expectedTotalCents: 1990 });
    check("Pedido pendente criado com código único", o1.status === "PENDING" && o1.code.startsWith("PTO-"));
    const sent = mock.links.at(-1)?.body as { order_nsu: string; items: { price: number }[]; handle: string; webhook_url: string };
    check("Link solicitado à InfinitePay com preço do banco (centavos)", sent?.order_nsu === o1.code && sent.items[0].price === 1990 && sent.handle === "teste-local", JSON.stringify(sent?.items));
    check("URL de checkout registrada", checkoutUrl.includes(o1.code));

    // 7. Antes de pagar: sem acesso
    const pre = await download(paidA.id, b1.cookie);
    check("Comprador não baixa antes da confirmação", pre.status === 403, String(pre.status));

    // 8. Pagamento pendente/recusado não libera
    mock.txs.set("TX-PEND-1", { paid: false, amount: 1990, order_nsu: o1.code });
    const wPend = await webhook({ order_nsu: o1.code, transaction_nsu: "TX-PEND-1", invoice_slug: "slug-1", amount: 1990, paid_amount: 1990 });
    const o1pend = await prisma.order.findUnique({ where: { id: o1.id } });
    check("Webhook de pagamento não aprovado mantém pendente", wPend.status === 200 && o1pend?.status === "PENDING", wPend.json?.outcome);
    const fake = await webhook({ order_nsu: o1.code, transaction_nsu: "TX-FALSO", invoice_slug: "slug-x", amount: 1990 });
    const o1fake = await prisma.order.findUnique({ where: { id: o1.id } });
    check("Webhook forjado (transação inexistente) não libera", fake.status === 200 && o1fake?.status === "PENDING", fake.json?.outcome);

    // 9. Aprovado → libera só o produto correto
    mock.txs.set("TX-OK-1", { paid: true, amount: 1990, order_nsu: o1.code });
    const wOk = await webhook({ order_nsu: o1.code, transaction_nsu: "TX-OK-1", invoice_slug: "slug-ok-1", amount: 1990, paid_amount: 1990, receipt_url: "https://recibo.example/1" });
    const o1paid = await prisma.order.findUnique({ where: { id: o1.id } });
    const ents1 = await prisma.entitlement.findMany({ where: { userId: b1.user.id } });
    check("Pagamento confirmado via payment_check marca pedido como pago", wOk.status === 200 && o1paid?.status === "PAID", wOk.json?.outcome);
    check("Somente o produto comprado foi liberado", ents1.length === 1 && ents1[0].productId === paidA.id);
    check("payment_check recebeu order_nsu, transaction_nsu e slug", mock.checks.some((c) => c.order_nsu === o1.code && c.transaction_nsu === "TX-OK-1" && c.slug === "slug-ok-1"));

    // 10. Notificação duplicada
    const wDup = await webhook({ order_nsu: o1.code, transaction_nsu: "TX-OK-1", invoice_slug: "slug-ok-1", amount: 1990 });
    const ents1b = await prisma.entitlement.count({ where: { userId: b1.user.id } });
    const paidEvents = await prisma.paymentEvent.count({ where: { orderId: o1.id, outcome: "PAID" } });
    check("Notificação duplicada não duplica liberação", wDup.json?.outcome === "ALREADY_PAID" && ents1b === 1 && paidEvents === 1, wDup.json?.outcome);
    const ret = await req(`/pagamento/retorno?order_nsu=${o1.code}&transaction_nsu=TX-OK-1&slug=slug-ok-1`, { cookie: b1.cookie });
    check("Página de retorno mostra pagamento confirmado", ret.status === 200 && (await ret.text()).includes("Pagamento confirmado"));

    // 11. Acesso aos arquivos pagos
    const dl = await download(paidA.id, b1.cookie);
    check("Comprador baixa o produto pago", dl.status === 200 && dl.body === "PAID-A-CONTENT", String(dl.status));
    const dlB = await download(paidB.id, b1.cookie);
    check("Comprador não baixa produto que não comprou", dlB.status === 403, String(dlB.status));
    const other = await download(paidA.id, b2.cookie);
    check("Outro usuário não baixa produto pago de outra pessoa", other.status === 403, String(other.status));
    const anon = await download(paidA.id);
    check("Visitante é enviado ao login ao tentar baixar pago", anon.status !== 200);
    const linkSteal = await req(dl.location!, { cookie: b2.cookie });
    check("Link temporário do comprador não funciona para outro usuário", linkSteal.status === 403, String(linkSteal.status));
    const linkAnon = await req(dl.location!);
    check("Link temporário do comprador não funciona sem login", linkAnon.status === 403);
    const myProducts = await (await req("/conta/produtos", { cookie: b1.cookie })).text();
    check("Produto aparece em Meus produtos", myProducts.includes("Script pago A"));
    const otherOrder = await req(`/conta/pedidos/${o1.code}`, { cookie: b2.cookie });
    check("Usuário não vê pedido de outra pessoa", otherOrder.status === 404, String(otherOrder.status));

    // 12. Alterar preço não muda pedido antigo
    await prisma.product.update({ where: { id: paidA.id }, data: { priceCents: 4990 } });
    const item = await prisma.orderItem.findFirst({ where: { orderId: o1.id } });
    const o1after = await prisma.order.findUnique({ where: { id: o1.id } });
    check("Alteração de preço não modifica pedido antigo", item?.unitPriceCents === 1990 && o1after?.totalCents === 1990);
    const q2 = await (await req("/api/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [paidA.id] }) })).json();
    check("Novo preço vale para novos pedidos", q2.items[0].priceCents === 4990);

    // 13. Valor divergente → análise, sem liberação
    const { order: o2 } = await createOrderAndCheckout({ user: b2.user, productIds: [paidB.id], expectedTotalCents: 2990 });
    mock.txs.set("TX-MIS-1", { paid: true, amount: 100, order_nsu: o2.code });
    await webhook({ order_nsu: o2.code, transaction_nsu: "TX-MIS-1", invoice_slug: "slug-mis" });
    const o2r = await prisma.order.findUnique({ where: { id: o2.id } });
    const ents2 = await prisma.entitlement.count({ where: { userId: b2.user.id } });
    check("Valor divergente vai para análise e não libera", o2r?.status === "NEEDS_REVIEW" && ents2 === 0, o2r?.status);

    // 14. Retorno do navegador com pagamento recusado
    const { order: o3 } = await createOrderAndCheckout({ user: b2.user, productIds: [paidB.id], expectedTotalCents: 2990 });
    mock.txs.set("TX-REC-1", { paid: false, amount: 2990, order_nsu: o3.code });
    const retR = await (await req(`/pagamento/retorno?order_nsu=${o3.code}&transaction_nsu=TX-REC-1&slug=slug-rec`, { cookie: b2.cookie })).text();
    const o3r = await prisma.order.findUnique({ where: { id: o3.id } });
    check("Voltar para a página de retorno não marca como pago", o3r?.status === "PENDING" && retR.includes("Aguardando confirmação"));

    // 15. Transação reutilizada em outro pedido
    mock.txs.set("TX-OK-1", { paid: true, amount: 2990, order_nsu: o3.code });
    await webhook({ order_nsu: o3.code, transaction_nsu: "TX-OK-1", invoice_slug: "slug-ok-1" });
    const o3c = await prisma.order.findUnique({ where: { id: o3.id } });
    check("transaction_nsu já usado em outro pedido não libera", o3c?.status !== "PAID" && (await prisma.entitlement.count({ where: { userId: b2.user.id } })) === 0, o3c?.status);

    // 16. Webhook de pedido inexistente / payload inválido
    const wNf = await webhook({ order_nsu: "E2E-INEXISTENTE", transaction_nsu: "x", invoice_slug: "y" });
    check("Webhook com pedido inexistente é registrado sem erro", wNf.status === 200 && wNf.json?.outcome === "ORDER_NOT_FOUND");
    const wBad = await req("/api/webhooks/infinitepay", { method: "POST", body: "não é json" });
    check("Webhook com payload inválido responde 400", wBad.status === 400);

    // 17. Painel administrativo
    const admUser = await req("/admin", { cookie: b1.cookie });
    check("Usuário comum não acessa o painel", admUser.status === 307 || admUser.status === 302 || admUser.status === 303, String(admUser.status));
    const admAnon = await req("/admin");
    check("Visitante é redirecionado do painel", [302, 303, 307].includes(admAnon.status));
    for (const p of ["/admin", "/admin/produtos", "/admin/produtos/novo", `/admin/produtos/${paidA.id}`, "/admin/categorias", "/admin/pedidos", `/admin/pedidos/${o1.id}`, "/admin/usuarios", "/admin/moderacao", "/admin/sugestoes", "/admin/paginas", "/admin/noticias", "/admin/eventos", "/admin/faq", "/admin/servidor", "/admin/configuracoes", "/admin/logs"]) {
      const r = await req(p, { cookie: admin.cookie });
      check(`Admin GET ${p}`, r.status === 200, String(r.status));
    }
    const dash = await (await req("/admin", { cookie: admin.cookie })).text();
    check("Painel lista pendências de configuração", dash.includes("Dados do site ainda não informados") && dash.includes("Endereço/link de conexão"));

    // 18. Upload privado (streaming)
    const upOk = await req("/api/admin/upload", { method: "PUT", cookie: admin.cookie, headers: { Origin: BASE, "X-File-Name": "teste.zip", "Content-Type": "application/octet-stream" }, body: "ZIPDATA" });
    const upJson = await upOk.json();
    check("Admin envia arquivo privado", upOk.status === 200 && upJson.size === 7, JSON.stringify(upJson));
    if (upJson.id) {
      const f = await prisma.storedFile.delete({ where: { id: upJson.id } });
      fs.rmSync(path.resolve(process.env.STORAGE_PRIVATE_DIR || "./storage/private", f.storageKey), { force: true });
    }
    const upUser = await req("/api/admin/upload", { method: "PUT", cookie: b1.cookie, headers: { Origin: BASE, "X-File-Name": "x.zip" }, body: "x" });
    check("Usuário comum não envia arquivos", upUser.status === 403);
    const upExt = await req("/api/admin/upload", { method: "PUT", cookie: admin.cookie, headers: { Origin: BASE, "X-File-Name": "virus.exe" }, body: "MZ" });
    check("Tipo de arquivo não permitido é recusado", upExt.status === 400);
    const upCsrf = await req("/api/admin/upload", { method: "PUT", cookie: admin.cookie, headers: { Origin: "https://site-malicioso.example", "X-File-Name": "a.zip" }, body: "x" });
    check("Upload de outra origem (CSRF) é recusado", upCsrf.status === 403);
    const trav = await req("/media/..%2F..%2F.env");
    const travBody = await trav.text();
    check("Acesso a arquivos fora da pasta pública é bloqueado", [400, 404].includes(trav.status) && !travBody.includes("APP_SECRET"), String(trav.status));
    const privDirect = await req("/storage/private");
    check("Pasta privada não é servida", privDirect.status === 404);

    // 19. Links oficiais e dados ausentes
    const home = await (await req("/")).text();
    check("Discord aponta para o link correto", home.includes("https://discord.gg/pkfNgjjvA"));
    check("Instagram aponta para o link correto", home.includes("https://www.instagram.com/jhony_torres_ofc/"));
    check("Status do servidor não configurado aparece como tal", home.includes("ainda não foi configurado"));
    const srv = await (await req("/servidor")).text();
    check("Conexão ao servidor pendente (sem IP inventado)", srv.includes("Endereço de conexão em breve"));
    check("Aviso de não afiliação com a Rockstar", home.includes("aprovados, patrocinados ou endossados pela") && home.includes("Rockstar Games"));
  } finally {
    await cleanup();
    mock.server.close();
    await prisma.$disconnect();
  }
  console.log(`\nResultado: ${pass} aprovados, ${fail} falharam.`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
