import { PostList } from "@/components/posts";

export const metadata = { title: "Tutoriais" };
export const dynamic = "force-dynamic";

export default function TutorialsPage() {
  return <PostList types={["TUTORIAL"]} eyebrow="Aprenda" title="Tutoriais" subtitle="Guias para instalar mods, configurar recursos e começar no FiveM." />;
}
