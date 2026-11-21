import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInclude } from "@/lib/catalog";
import { EmptyState, ProductGrid } from "@/components/ui";

export const metadata = { title: "Favoritos" };

export default async function MyFavorites() {
  const user = await requireUser("/conta/favoritos");
  const favs = await prisma.favorite.findMany({
    where: { userId: user.id, product: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: { product: { include: cardInclude } },
  });
  return (
    <ProductGrid
      items={favs.map((f) => f.product)}
      empty={<EmptyState icon="heart" title="Nenhum favorito ainda" text="Use o botão Favoritar na página de um mod para salvá-lo aqui." action={<Link href="/mods" className="btn-primary">Explorar mods</Link>} />}
    />
  );
}
