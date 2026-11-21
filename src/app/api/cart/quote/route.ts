import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { quoteCart } from "@/lib/payments";
import { ipFromRequest, rateLimit } from "@/lib/misc";

/** Recalcula o carrinho com preços do banco de dados. */
export async function POST(req: Request) {
  if (!rateLimit(`quote:${ipFromRequest(req)}`, 120, 60_000).ok) return NextResponse.json({ error: "rate" }, { status: 429 });
  let ids: unknown;
  try {
    ids = (await req.json())?.ids;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids" }, { status: 400 });
  const user = await getCurrentUser();
  const q = await quoteCart(ids.filter((x): x is string => typeof x === "string"), user?.id);
  return NextResponse.json({ items: q.items, totalCents: q.totalCents, missing: q.missing, loggedIn: Boolean(user) });
}
