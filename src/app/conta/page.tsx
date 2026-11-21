import { requireUser } from "@/lib/auth";
import { ActionForm, Field, PasswordInput, SubmitButton } from "@/components/forms";
import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Dados da conta</h2>
        <ActionForm action={updateProfileAction}>
          <Field label="Nome" name="name">
            <input id="name" name="name" defaultValue={user.name} required className="input" autoComplete="name" />
          </Field>
          <Field label="E-mail" name="email">
            <input id="email" name="email" type="email" defaultValue={user.email} required className="input" autoComplete="email" />
          </Field>
          <Field label="Senha atual" name="currentPassword" hint="Necessária apenas se for alterar o e-mail.">
            <PasswordInput name="currentPassword" id="currentPassword" />
          </Field>
          <SubmitButton>Salvar dados</SubmitButton>
        </ActionForm>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Alterar senha</h2>
        <ActionForm action={changePasswordAction} resetOnSuccess>
          <Field label="Senha atual" name="cp">
            <PasswordInput name="currentPassword" id="cp" required />
          </Field>
          <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres, com letras e números.">
            <PasswordInput required autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha" name="password2">
            <PasswordInput name="password2" required autoComplete="new-password" />
          </Field>
          <SubmitButton>Alterar senha</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
