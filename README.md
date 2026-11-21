# Palmas TO — gta5modsfivem.com.br

Site da comunidade **Palmas TO**: área do servidor de roleplay (FiveM) + catálogo de mods, scripts e recursos com downloads gratuitos, loja com **Checkout Integrado InfinitePay**, área do usuário e painel administrativo.

**Tecnologias:** Next.js 15 (App Router) + React 19 + TypeScript · Prisma 6 · MySQL/MariaDB · Tailwind CSS 4 · autenticação própria (sessões em banco, bcrypt) · armazenamento local configurável (público/privado).

---

## 1. Rodar localmente

Requisitos: Node.js 20+ (testado com 24) e MySQL 8 / MariaDB 10.6+.

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL e APP_SECRET
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # categorias + modelos de páginas (marcados “precisa de revisão”)
npm run admin:create -- --email seu@email.com --name "Jhony"   # pede a senha no terminal
npm run dev                   # http://localhost:3000
```

Gerar o `APP_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```


### Produção

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # usa a variável PORT (padrão 3000). O build aplica migrações e seed.
```

Defina também `TZ=America/Araguaina` no ambiente e `TRUST_PROXY=true` se houver proxy reverso.

---

## 2. Painel administrativo (`/admin`)

O primeiro administrador é criado **só pelo terminal** (`npm run admin:create`), sem senha fixa no código. Se o e-mail já tiver conta, ela é promovida a admin. Outros admins podem ser promovidos em **Usuários**.

| Área | O que faz |
|---|---|
| Visão geral | Vendas e downloads reais, pendências de configuração, eventos de pagamento que pedem atenção |
| Configurações | Textos da home, Discord/Instagram, contato, dados legais, apresentação do servidor, link/IP de conexão, fonte de status |
| Produtos | Cadastro completo, preço, promoção, tipo de venda, conformidade, galeria, versões e arquivos |
| Categorias | Criar, editar, ordenar, desativar (com subcategorias) |
| Pedidos e pagamentos | Status, eventos da InfinitePay, conciliação manual, registro de estorno/cancelamento |
| Usuários | Bloquear, promover, conceder/revogar acesso a produtos |
| Comentários e avaliações | Ocultar, mostrar, remover |
| Servidor | Atividades, profissões, locais, sistemas e galeria da cidade |
| Páginas | Como jogar, regras, contato e páginas legais |
| Notícias / Eventos / FAQ | Conteúdo da comunidade |
| Sugestões | Indicações de usuários — nunca publicadas automaticamente |
| Registro de ações | Log de auditoria das ações administrativas |

### Cadastrar um mod gratuito
1. **Produtos → Novo produto**. Preencha título, descrição, categoria, autor, licença, compatibilidade (só o que for verificado).
2. Tipo **Gratuito**, venda **Download gratuito no site**, status **Rascunho** → *Criar produto*.
3. Na tela do produto: adicione imagens e, em **Nova versão**, informe `1.0.0` e envie o arquivo (zip, rar, 7z, oiv, rpf, lua, txt, pdf).
4. Mude o status para **Publicado** e salve. Opcional: “Exigir conta para baixar”.

### Cadastrar um produto pago e definir o preço
1. **Novo produto** → tipo **Pago**, preço (ex.: `29,90`), promoção opcional.
2. Escolha **como é vendido**:
   - *Checkout InfinitePay (neste site)* — entrega por arquivo privado ou manual;
   - *Tebex* / *Cfx Marketplace* / *Link externo* — informe o link; a compra acontece fora do site.
3. Salve como **Rascunho**, envie o arquivo em **Nova versão**.
4. Para vender via InfinitePay, faça a **revisão de conformidade** (seção 6) e marque “Revisado — venda direta permitida”.
5. Publique. O sistema recusa a publicação se faltar preço, link externo, arquivo ou revisão.

Alterar o preço depois **não altera pedidos já feitos** (cada pedido guarda título, preço e licença do momento da compra).

---

## 3. InfinitePay (Checkout Integrado)

Documentação oficial consultada em nov/2026: <https://www.infinitepay.io/checkout-documentacao>.

### Configurar
No `.env` do servidor (ou nas variáveis de ambiente da hospedagem) — **nunca** no painel, no Git ou em mensagens:

```env
INFINITEPAY_HANDLE="sua_infinitetag_sem_cifrao"
INFINITEPAY_API_KEY="inchk_..."        # recomendado
INFINITEPAY_ENABLED="true"             # só depois de validar
INFINITEPAY_LINK_TTL_MINUTES=60
APP_URL="https://gta5modsfivem.com.br" # usado no redirect_url e webhook_url
```

A API key é criada no app/Conta Web InfinitePay e aparece só uma vez. **Sem a API key** a InfinitePay não aceita `single_payment` nem `valid_until`: o link não expira e pode aceitar mais de um pagamento. O painel avisa quando ela está ausente.

### Fluxo implementado
1. O cliente revisa o carrinho e confirma o total (o preço vem do banco; se mudou, o pedido é recusado).
2. É criado um pedido `PENDING` com `order_nsu` único (`PTO-...`) e preços congelados.
3. O backend chama `POST /links` (centavos, `redirect_url`, `webhook_url`, e com API key `single_payment` + `valid_until`).
4. O cliente vai para a página oficial da InfinitePay (Pix ou cartão). Não há iframe nem checkout transparente.
5. O **webhook** (`/api/webhooks/infinitepay`) e o **retorno** (`/pagamento/retorno`) são tratados só como avisos.
6. O backend confirma com `POST /payment_check` (order_nsu + transaction_nsu + slug). Só com `paid: true` e `amount` igual ao total o pedido vira `PAID` e libera **apenas** os produtos do pedido.
7. Notificações repetidas não duplicam nada (atualização condicional + `transaction_nsu` único). Divergência de valor ou transação reutilizada → `Em análise`.
8. Tudo fica registrado em **Eventos de pagamento** para conciliação.

Estornos e cancelamentos só podem ser feitos no app InfinitePay. Avisos desse tipo vão para conciliação; registre o estorno no pedido (o acesso é revogado). Links criados **não podem ser cancelados** pela API.

### Sem sandbox — como validar com cobrança real (com sua autorização)
A InfinitePay não oferece ambiente de testes: qualquer link é real. Os testes automáticos usam um **simulador local** (`scripts/mock-infinitepay.ts`). Para validar de verdade, depois do deploy em HTTPS:
1. Cadastre um produto de teste de **R$ 1,00** (mínimo), revisado, com arquivo, e publique por poucos minutos (só produtos publicados podem ir ao carrinho).
2. Compre com sua própria conta via Pix.
3. Confira: pedido `Pago`, produto em *Meus produtos*, eventos `WEBHOOK`/`REDIRECT` → `PAID` no painel.
4. Estorne pelo app InfinitePay e registre o estorno no pedido.

O webhook só funciona em URL pública HTTPS (não chega em `localhost`).

---

## 4. Arquivos e armazenamento

- **Imagens públicas** → `STORAGE_PUBLIC_DIR`, servidas em `/media/...` com cache.
- **Arquivos de produto** → `STORAGE_PRIVATE_DIR` (fora de `/public`). Entrega só por **link temporário assinado** (`DOWNLOAD_LINK_TTL_SECONDS`, padrão 10 min) após checar permissão no servidor. Em produtos pagos o link é vinculado ao comprador.
- Upload de arquivos de produto em **streaming** (sem carregar na memória), com limite `MAX_FILE_UPLOAD_MB`, lista de extensões permitidas, SHA-256 e registro por versão. Imagens têm a assinatura binária verificada.
- Downloads suportam `Range` (retomar). Respeite os limites de upload do proxy (ex.: `client_max_body_size` no Nginx).
- Não há antivírus automático; o site **não exibe selo de “arquivo seguro”**. Para usar S3/R2, reimplemente `saveStream/openRead/removeKey` em `src/lib/storage.ts`.

## 5. Domínio (quando autorizar)
1. Hospedagem com Node.js 20+ e MySQL. Configure o `.env` de produção com `APP_URL="https://gta5modsfivem.com.br"`.
2. Aponte o DNS do domínio para a hospedagem e ative HTTPS.
3. `npx prisma migrate deploy && npm run build && npm start` (ou o gerenciador da hospedagem / PM2).
Nada disso foi feito — nenhum deploy, DNS ou produção foi alterado.

## 6. Regras FiveM / Cfx / Rockstar — verifique antes de vender
- A documentação da Cfx sobre Tebex afirma que a **Tebex é a parceira exclusiva de monetização de servidores** e que usar outro provedor de pagamento para isso viola o *Platform License Agreement*. Portanto **não venda vantagens/itens/VIP do servidor Palmas TO pela InfinitePay**.
- Venda de scripts/recursos para outros donos de servidor: não consegui confirmar a regra atual (o PDF do PLA não pôde ser lido automaticamente e a FAQ do Asset Escrow bloqueou o acesso, HTTP 403). Por isso todo produto pago via InfinitePay exige **revisão manual de conformidade** no painel. Leia: <https://fivem.net/terms> e <https://support.cfx.re/hc/en-us/articles/8016100729372>.
- Recursos com **Asset Escrow** devem usar a opção Tebex/Cfx Marketplace com entrega “pela plataforma externa”. O site não confirma compras externas.
- Publique apenas conteúdo próprio ou autorizado. Sugestões de terceiros passam por análise manual.
- O rodapé informa que o projeto não é aprovado, patrocinado ou endossado pela Rockstar Games, Take-Two ou Cfx.re.

## 7. Backup

```bash
# banco
mysqldump -u USUARIO -p --single-transaction gta5modsfivem > backup-$(date +%F).sql
# arquivos (imagens + arquivos privados)
tar -czf storage-$(date +%F).tar.gz storage/
```
Guarde também o `.env` em local seguro (sem ele os links assinados e sessões mudam). Restaurar: `mysql ... < backup.sql` e extrair `storage/`.

## 8. Testes

```bash
npm test          # testes unitários (preço, dinheiro, tokens, InfinitePay)
npm run lint      # verificação de tipos
# E2E: servidor rodando com o simulador da InfinitePay
INFINITEPAY_ENABLED=true INFINITEPAY_HANDLE=teste-local INFINITEPAY_API_BASE=http://127.0.0.1:4010 npm run dev
npm run test:e2e  # cria dados [TESTE-E2E] e apaga ao final
```

## 9. Ainda falta antes de publicar
- [ ] Criar seu admin (`npm run admin:create`) e definir senha forte.
- [ ] InfiniteTag + API key no `.env` de produção; validar com compra real de R$ 1,00.
- [ ] Revisar e marcar como revisadas as páginas: Como jogar, Regras, Contato, Termos, Privacidade, Reembolso, Licença, Remoção (contêm marcadores **[preencher]**).
- [ ] Preencher em Configurações: e-mail de contato, nome/documento do responsável, apresentação do servidor, link/código cfx.re ou IP, fonte de status.
- [ ] SMTP para recuperação de senha (opcional, mas recomendado).
- [ ] Confirmar as regras da Cfx para cada produto pago (seção 6).
- [ ] Cadastrar categorias/produtos reais, imagens e arquivos.
- [ ] Hospedagem, HTTPS, DNS e backups automáticos (com sua autorização).
