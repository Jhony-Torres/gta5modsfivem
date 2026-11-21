import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashIp, signToken } from "@/lib/crypto";
import { ipFromRequest, rateLimit } from "@/lib/misc";
import { env } from "@/lib/env";

/**
 * Solicita um download. Valida permissão no servidor, registra a estatística
 * e redireciona para um link temporário assinado (/api/files/<token>).
 */
export async function POST(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const ip = ipFromRequest(req);
  const back = (path: string) => NextResponse.redirect(new URL(path, env.appUrl), 303);

  if (!rateLimit(`dl:${ip}`, 40, 10 * 60_000).ok) {
    return new NextResponse("Muitos downloads em pouco tempo. Aguarde alguns minutos.", { status: 429 });
  }
  const user = await getCurrentUser();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { versions: { where: { fileId: { not: null } }, orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }], take: 1, include: { file: true } } },
  });
  if (!product || (product.status !== "PUBLISHED" && user?.role !== "ADMIN")) {
    return new NextResponse("Produto não encontrado.", { status: 404 });
  }
  const version = product.versions[0];
  if (!version?.file) return new NextResponse("Arquivo indisponível.", { status: 404 });

  if (product.pricingType === "PAID") {
    if (!user) return back(`/entrar?next=/mods/${product.slug}`);
    if (user.role !== "ADMIN") {
      const ent = await prisma.entitlement.findFirst({ where: { userId: user.id, productId: product.id, revokedAt: null } });
      if (!ent) return new NextResponse("Você não possui acesso a este arquivo.", { status: 403 });
    }
    if (product.deliveryType !== "SITE_FILE" && user.role !== "ADMIN") {
      return new NextResponse("Este produto não é entregue por download neste site.", { status: 403 });
    }
  } else if (product.requireLogin && !user) {
    return back(`/entrar?next=/mods/${product.slug}`);
  }

  // Estatística real: conta no máximo 1 download por pessoa/IP a cada 1 hora
  const ipHash = hashIp(ip + "|" + (req.headers.get("user-agent") || ""));
  const since = new Date(Date.now() - 60 * 60_000);
  const recent = await prisma.download.findFirst({
    where: { productId: product.id, createdAt: { gte: since }, ...(user ? { userId: user.id } : { ipHash }) },
  });
  if (!recent) {
    await prisma.$transaction([
      prisma.download.create({ data: { productId: product.id, versionId: version.id, userId: user?.id ?? null, ipHash } }),
      prisma.product.update({ where: { id: product.id }, data: { downloadCount: { increment: 1 } } }),
    ]);
  } else if (user && !recent.userId) {
    // garante que apareça no histórico do usuário
    await prisma.download.update({ where: { id: recent.id }, data: { userId: user.id } });
  }

  const token = signToken(
    { f: version.file.id, p: product.id, u: product.pricingType === "PAID" ? user!.id : null },
    env.downloadTtl,
  );
  return NextResponse.redirect(new URL(`/api/files/${token}`, env.appUrl), 303);
}

export function GET() {
  return new NextResponse("Use o botão de download na página do produto.", { status: 405 });
}
