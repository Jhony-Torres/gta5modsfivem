import { PostList } from "@/components/posts";

export const metadata = { title: "Novidades" };
export const dynamic = "force-dynamic";

export default function NewsPage() {
  return <PostList types={["NEWS", "UPDATE"]} eyebrow="Comunidade" title="Notícias e atualizações" subtitle="O que há de novo na cidade e no site." />;
}
