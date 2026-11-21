import Link from "next/link";
import { ActionForm, Field, PasswordInput, SubmitButton } from "@/components/forms";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata = { title: "Redefinir senha" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container-pto flex justify-center py-14">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Nova senha</h1>
        {!token ? (
          <p className="mt-4 text-sm text-muted">
            Link inválido. <Link href="/recuperar-senha" className="text-sun underline">Solicite um novo link</Link>.
          </p>
        ) : (
          <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres, com letras e números.">
              <PasswordInput required autoComplete="new-password" />
            </Field>
            <Field label="Confirmar nova senha" name="password2">
              <PasswordInput name="password2" required autoComplete="new-password" />
            </Field>
            <SubmitButton className="btn-primary w-full">Salvar nova senha</SubmitButton>
            <p className="text-center text-sm">
              <Link href="/entrar" className="text-sun hover:underline">Ir para o login</Link>
            </p>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
