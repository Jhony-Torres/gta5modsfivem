import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Markdown } from "@/lib/markdown";
import { formatDate } from "@/lib/misc";
import { TYPE_LABEL } from "@/components/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await prisma.post.findUnique({ where: { slug: (await params).slug } });
  return { title: p?.published ? p.title : "Publicação", description: p?.excerpt ?? undefined };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await prisma.post.findUnique({ where: { slug: (await params).slug } });
  const user = await getCurrentUser();
  if (!post || (!post.published && user?.role !== "ADMIN")) notFound();
  return (
    <article className="container-pto max-w-3xl py-10">
      <Link href={post.type === "TUTORIAL" ? "/tutoriais" : "/noticias"} className="text-sm text-sun hover:underline">← Voltar</Link>
      <p className="mt-6 text-xs uppercase tracking-wider text-muted">{TYPE_LABEL[post.type]} · {formatDate(post.publishedAt ?? post.createdAt)}</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{post.title}</h1>
      {post.excerpt && <p className="mt-3 text-lg text-muted">{post.excerpt}</p>}
      {post.coverImage && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-2xl border border-line">
          <Image src={post.coverImage} alt="" fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div className="mt-8"><Markdown source={post.body} /></div>
    </article>
  );
}
