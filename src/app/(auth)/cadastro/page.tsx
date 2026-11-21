import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, PasswordInput, SubmitButton } from "@/components/forms";
import { registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/conta");
  return (
    <div className="container-pto flex justify-center py-14">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Para baixar arquivos gratuitos não é preciso conta. Ela é necessária para comprar, comentar e favoritar.</p>
        <ActionForm action={registerAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Nome" name="name">
            <input id="name" name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
          </Field>
          <Field label="E-mail" name="email">
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </Field>
          <Field label="Senha" name="password" hint="Mínimo de 8 caracteres, com letras e números.">
            <PasswordInput required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar senha" name="password2">
            <PasswordInput name="password2" required minLength={8} autoComplete="new-password" />
          </Field>
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input type="checkbox" name="terms" required className="mt-1 accent-[var(--color-sun)]" />
            <span>
              Li e aceito os{" "}
              <Link href="/legal/termos" className="text-sun underline" target="_blank">
                termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/legal/privacidade" className="text-sun underline" target="_blank">
                política de privacidade
              </Link>
              .
            </span>
          </label>
          <SubmitButton className="btn-primary w-full" pendingText="Criando conta...">
            Criar conta
          </SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-sun hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
