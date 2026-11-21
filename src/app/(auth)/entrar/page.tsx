import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, PasswordInput, SubmitButton } from "@/components/forms";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/conta");
  return (
    <div className="container-pto flex justify-center py-14">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesse sua conta para comprar, comentar e acompanhar seus downloads.</p>
        <ActionForm action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="E-mail" name="email">
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </Field>
          <Field label="Senha" name="password">
            <PasswordInput required />
          </Field>
          <div className="flex justify-end text-sm">
            <Link href="/recuperar-senha" className="text-sun hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <SubmitButton className="btn-primary w-full" pendingText="Entrando...">
            Entrar
          </SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-sun hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
