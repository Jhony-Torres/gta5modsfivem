/**
 * Seed inicial (idempotente): categorias e MODELOS de páginas.
 * Não cria produtos, avaliações, números ou regras do servidor.
 * Os modelos de páginas ficam marcados como "precisa de revisão".
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES: { name: string; slug: string; icon: string; children?: { name: string; slug: string; icon: string }[] }[] = [
  {
    name: "Veículos",
    slug: "veiculos",
    icon: "car",
    children: [
      { name: "Carros", slug: "carros", icon: "car" },
      { name: "Motos", slug: "motos", icon: "bike" },
      { name: "Ônibus", slug: "onibus", icon: "bus" },
      { name: "Viaturas e emergência", slug: "viaturas-emergencia", icon: "siren" },
    ],
  },
  { name: "Mapas e MLOs", slug: "mapas-mlos", icon: "map" },
  { name: "Scripts", slug: "scripts", icon: "code" },
  { name: "Interfaces e HUDs", slug: "interfaces-huds", icon: "layout" },
  { name: "Sistemas para servidores", slug: "sistemas-servidores", icon: "server" },
  { name: "Empregos e profissões", slug: "empregos-profissoes", icon: "briefcase" },
  { name: "Roupas e uniformes", slug: "roupas-uniformes", icon: "shirt" },
  { name: "Personagens e skins", slug: "personagens-skins", icon: "user" },
  { name: "Texturas e pinturas", slug: "texturas-pinturas", icon: "palette" },
  { name: "Armas e acessórios", slug: "armas-acessorios", icon: "target" },
  { name: "Sons", slug: "sons", icon: "music" },
  { name: "Ferramentas", slug: "ferramentas", icon: "wrench" },
  { name: "Códigos para desenvolvedores", slug: "codigos-desenvolvedores", icon: "terminal" },
  { name: "Outros", slug: "outros", icon: "box" },
];

const P = (s: string) => `**[preencher: ${s}]**`;

const PAGES: { slug: string; title: string; body: string }[] = [
  {
    slug: "como-jogar",
    title: "Como jogar no Palmas TO",
    body: `## 1. O que você precisa
- Uma cópia original do **Grand Theft Auto V** para PC (Steam, Epic Games ou Rockstar Games Launcher).
- Um computador que rode o GTA V.
- O **FiveM**, cliente gratuito da Cfx.re: [fivem.net](https://fivem.net).
- Uma conta no **Discord** para participar da comunidade.

## 2. Instalando o FiveM
1. Acesse [fivem.net](https://fivem.net) e baixe o instalador para Windows.
2. Execute o instalador e aguarde o download dos arquivos.
3. Abra o FiveM. Na primeira vez ele localiza o GTA V instalado no computador.

## 3. Entrando no servidor
${P("explique como encontrar o servidor: botão Conectar deste site, busca pelo nome na lista do FiveM ou comando connect no F8")}

## 4. Discord
Entre no nosso Discord pelo botão abaixo. ${P("explique se é necessário fazer whitelist, cadastro ou verificação")}

## 5. Regras
Leia as [regras do servidor](/regras) antes de jogar.

## 6. Suporte
${P("explique onde pedir suporte: canal do Discord, tickets, horários")}`,
  },
  { slug: "regras", title: "Regras do servidor", body: `${P("cole aqui as regras oficiais do servidor Palmas TO")}` },
  {
    slug: "contato",
    title: "Contato e suporte",
    body: `Fale com a equipe do Palmas TO pelos canais abaixo.

- Responsável: {{contact.responsible}}
- E-mail: {{contact.email}}

Para dúvidas sobre pedidos, informe o **código do pedido** (ex.: PTO-...) que aparece em *Minha conta → Pedidos*.`,
  },
  {
    slug: "legal-termos",
    title: "Termos de uso",
    body: `> Modelo inicial. Revise com apoio jurídico antes de publicar.

## 1. Sobre o site
Este site é mantido por {{legal.entityName}} ({{legal.document}}), responsável: {{contact.responsible}}. Contato: {{contact.email}}.

O servidor Palmas TO e este site **não são aprovados, patrocinados ou endossados pela Rockstar Games, Take-Two Interactive ou Cfx.re**.

## 2. Conta
Você é responsável pela segurança da sua senha e pelas atividades realizadas na sua conta. Podemos bloquear contas que violem estes termos.

## 3. Conteúdo publicado
Os mods, scripts e recursos são publicados pela equipe, com autorização dos autores quando aplicável. Comentários e avaliações devem respeitar as regras da comunidade e podem ser moderados.

## 4. Uso dos arquivos
Cada produto possui sua própria licença, informada na página do produto. É proibido redistribuir ou revender arquivos sem autorização.

## 5. Alterações
Estes termos podem ser atualizados. A data da última atualização aparece no topo da página.

## 6. Foro
${P("defina o foro, por exemplo {{legal.city}}")}`,
  },
  {
    slug: "legal-privacidade",
    title: "Política de privacidade",
    body: `> Modelo inicial. Revise com apoio jurídico (LGPD) antes de publicar.

## Dados coletados
- **Conta:** nome, e-mail e senha (armazenada de forma criptografada com hash).
- **Pedidos:** itens, valores, status e identificadores da transação informados pela InfinitePay. **Não armazenamos dados de cartão.**
- **Downloads:** produto, data e um identificador do acesso derivado do IP (não guardamos o IP em texto puro).
- **Cookies:** apenas o cookie de sessão necessário para manter você conectado e o carrinho salvo no seu navegador.

## Finalidade
Prestar o serviço, entregar produtos comprados, prevenir fraudes e cumprir obrigações legais.

## Compartilhamento
Os dados necessários ao pagamento são enviados à InfinitePay quando você inicia uma compra.

## Seus direitos
Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail {{contact.email}}.

## Controlador
{{legal.entityName}} — {{legal.document}}`,
  },
  {
    slug: "legal-reembolso",
    title: "Política de compra e reembolso",
    body: `> Modelo inicial. Revise antes de publicar (Código de Defesa do Consumidor).

## Pagamento
Os pagamentos são processados pela InfinitePay (Pix ou cartão). O acesso ao produto é liberado **somente após a confirmação** do pagamento pela InfinitePay.

## Entrega
Produtos com entrega pelo site ficam disponíveis em *Minha conta → Meus produtos*. Produtos vendidos por plataformas externas (Tebex, Cfx Marketplace) seguem as regras dessas plataformas.

## Reembolso
${P("defina prazo e condições de reembolso para produtos digitais")}

Estornos aprovados removem o acesso ao produto.

## Contato
{{contact.email}}`,
  },
  {
    slug: "legal-licenca",
    title: "Licença e condições de uso dos produtos",
    body: `> Modelo inicial. Revise antes de publicar.

Salvo indicação diferente na página do produto:
- A compra concede uma licença de uso, não a propriedade do código ou dos arquivos.
- É proibido revender, redistribuir ou publicar os arquivos, no todo ou em parte.
- ${P("defina se a licença vale para um ou mais servidores")}

Recursos para FiveM devem ser usados de acordo com os termos da Cfx.re e da Rockstar Games.`,
  },
  {
    slug: "legal-remocao",
    title: "Direitos autorais e solicitação de remoção",
    body: `Respeitamos os direitos autorais. Se você é autor de um conteúdo publicado aqui sem autorização, envie para {{contact.email}}:

1. Seu nome e forma de contato.
2. Link da página do conteúdo neste site.
3. Comprovação da autoria ou da titularidade dos direitos.
4. Descrição do problema.

Analisaremos o pedido e removeremos o conteúdo quando cabível.`,
  },
];

async function main() {
  let order = 0;
  for (const c of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, icon: c.icon, sortOrder: order++ },
    });
    let sub = 0;
    for (const ch of c.children ?? []) {
      await prisma.category.upsert({
        where: { slug: ch.slug },
        update: {},
        create: { name: ch.name, slug: ch.slug, icon: ch.icon, parentId: parent.id, sortOrder: sub++ },
      });
    }
  }
  for (const p of PAGES) {
    await prisma.page.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, needsReview: true } });
  }
  console.log(`Seed concluído: ${CATEGORIES.length} categorias principais e ${PAGES.length} modelos de páginas (marcados para revisão).`);
}

main().finally(() => prisma.$disconnect());
