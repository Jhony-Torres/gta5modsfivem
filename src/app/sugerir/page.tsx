import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, safeUrl } from "@/lib/misc";
import { ActionForm, Field, SubmitButton, type ActionState } from "@/components/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Sugerir conteúdo" };
export const dynamic = "force-dynamic";

async function suggestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta." };
  if (!rateLimit(`suggest:${user.id}`, 5, 24 * 3600_000).ok) return { error: "Limite de sugestões atingido por hoje." };
  const title = String(fd.get("title") || "").trim();
  const description = String(fd.get("description") || "").trim();
  const url = String(fd.get("url") || "").trim();
  if (title.length < 3 || title.length > 150) return { error: "Informe um título (3 a 150 caracteres)." };
  if (description.length < 10 || description.length > 4000) return { error: "Descreva o conteúdo (mín. 10 caracteres)." };
  if (url && !safeUrl(url)) return { error: "Link inválido." };
  await prisma.suggestion.create({ data: { userId: user.id, title, description, url: url || null, isOwner: fd.get("isOwner") === "on" } });
  return { ok: true, message: "Sugestão enviada para análise. Obrigado!" };
}

export default async function SuggestPage() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader title="Sugerir conteúdo" subtitle="Indique um mod, script ou recurso. Toda sugestão passa por análise manual e nada é publicado ou vendido automaticamente." />
      <div className="container-pto mt-8 max-w-2xl space-y-4">
        <Notice>
          Envie apenas conteúdo de sua autoria ou com autorização do autor. Não envie arquivos pagos de terceiros, conteúdo pirateado ou que viole as regras da Rockstar/Cfx.
        </Notice>
        {!user ? (
          <p className="card p-5 text-sm"><Link className="text-sun underline" href="/entrar?next=/sugerir">Entre na sua conta</Link> para enviar uma sugestão.</p>
        ) : (
          <div className="card p-6">
            <ActionForm action={suggestAction} resetOnSuccess>
              <Field label="Título" name="title"><input id="title" name="title" required maxLength={150} className="input" /></Field>
              <Field label="Link (opcional)" name="url" hint="Página oficial do autor, repositório ou vídeo."><input id="url" name="url" type="url" className="input" /></Field>
              <Field label="Descrição" name="description"><textarea id="description" name="description" required rows={5} maxLength={4000} className="input" /></Field>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="isOwner" className="mt-1" /> Sou o autor ou tenho autorização do autor para divulgar este conteúdo.
              </label>
              <SubmitButton pendingText="Enviando...">Enviar sugestão</SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
