/**
 * Simulador LOCAL da API do Checkout Integrado InfinitePay — somente para testes.
 * Nenhuma cobrança real é criada. Use INFINITEPAY_API_BASE=http://127.0.0.1:4010
 *
 *  POST /links          -> devolve uma URL fictícia
 *  POST /payment_check  -> responde conforme o estado configurado em POST /__set
 */
import http from "node:http";

export type MockTx = { paid: boolean; amount: number; paid_amount?: number; capture_method?: string; order_nsu: string };

export function startMock(port = 4010) {
  const txs = new Map<string, MockTx>(); // chave: transaction_nsu
  const links: { body: Record<string, unknown> }[] = [];
  const checks: Record<string, unknown>[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    const send = (code: number, data: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.url === "/links" && req.method === "POST") {
      links.push({ body });
      return send(200, { url: `https://checkout.infinitepay.example/teste/${body.order_nsu}` });
    }
    if (req.url === "/payment_check" && req.method === "POST") {
      checks.push(body);
      const tx = txs.get(body.transaction_nsu);
      if (!tx || tx.order_nsu !== body.order_nsu || !body.slug) return send(200, { success: false, paid: false });
      return send(200, {
        success: true,
        paid: tx.paid,
        amount: tx.amount,
        paid_amount: tx.paid_amount ?? tx.amount,
        installments: 1,
        capture_method: tx.capture_method ?? "pix",
      });
    }
    send(404, { error: "not found" });
  });
  return new Promise<{ server: http.Server; txs: typeof txs; links: typeof links; checks: typeof checks }>((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve({ server, txs, links, checks })),
  );
}

if (process.argv[1]?.includes("mock-infinitepay")) {
  startMock().then(() => console.log("Mock InfinitePay em http://127.0.0.1:4010"));
}
