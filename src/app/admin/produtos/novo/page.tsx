import { prisma } from "@/lib/db";
import { ProductForm } from "../product-form";

export default async function NewProduct() {
  const categories = await prisma.category.findMany({ where: { parentId: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { children: { orderBy: { sortOrder: "asc" } } } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Novo produto</h1>
      <p className="text-sm text-muted">Depois de criar, você poderá adicionar a galeria de imagens e enviar os arquivos de cada versão.</p>
      <ProductForm categories={categories} />
    </div>
  );
}
