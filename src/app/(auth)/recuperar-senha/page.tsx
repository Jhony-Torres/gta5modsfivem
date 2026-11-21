import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { forgotPasswordAction } from "@/app/actions/auth";
import { mailConfigured } from "@/lib/mail";
import { Notice } from "@/components/ui";

export const metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  const enabled = mailConfigured();
  return (
    <div className="container-pto flex justify-center py-14">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Recuperar senha</h1>
        {!enabled ? (
          <div className="mt-5">
            <Notice tone="warn" title="Indisponível no momento">
              O envio de e-mails ainda não foi configurado neste site. Fale com o suporte pela página de contato ou pelo Discord.
            </Notice>
          </div>
        ) : (
          <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4" resetOnSuccess>
            <Field label="E-mail da conta" name="email">
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText="Enviando...">
              Enviar link de redefinição
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
