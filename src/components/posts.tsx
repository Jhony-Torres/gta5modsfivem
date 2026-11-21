import Link from "next/link";
import type { PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";
import { EmptyState, PageHeader, Thumb } from "./ui";

const TYPE_LABEL: Record<PostType, string> = { NEWS: "Notícia", UPDATE: "Atualização", TUTORIAL: "Tutorial" };

export async function PostList({ types, title, subtitle, eyebrow }: { types: PostType[]; title: string; subtitle: string; eyebrow?: string }) {
  const posts = await prisma.post.findMany({ where: { published: true, type: { in: types } }, orderBy: { publishedAt: "desc" }, take: 60 });
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="container-pto mt-8">
        {posts.length === 0 ? (
          <EmptyState icon="news" title="Nada publicado ainda" text="Quando a equipe publicar conteúdo, ele aparecerá aqui." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/noticias/${p.slug}`} className="card group overflow-hidden hover:border-sun/50">
                <Thumb src={p.coverImage} alt="" className="aspect-video" />
                <div className="p-4">
                  <p className="text-xs text-muted">{TYPE_LABEL[p.type]} · {formatDate(p.publishedAt)}</p>
                  <h2 className="mt-1 font-semibold group-hover:text-sun">{p.title}</h2>
                  {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export { TYPE_LABEL };
