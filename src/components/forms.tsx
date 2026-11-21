"use client";

import React, { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./icons";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

/** Botão de envio com estado de carregamento. */
export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Salvando...",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const status = useFormStatus();
  const pending = status.pending || React.useContext(PendingCtx);
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending ? (
        <>
          <Icon name="spinner" className="h-4 w-4" /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state || (!state.error && !state.message)) return null;
  const ok = !state.error;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
        ok ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"
      }`}
    >
      <Icon name={ok ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{state.error || state.message}</span>
    </div>
  );
}

const PendingCtx = React.createContext(false);

/**
 * Formulário ligado a uma Server Action com feedback de sucesso/erro.
 * Envia via transição (em vez de action={...}) para o React NÃO limpar os campos quando há erro.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
  confirmText,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingCtx.Provider value={pending}>{children}</PendingCtx.Provider>
      <FormMessage state={state} />
    </form>
  );
}

export function PasswordInput({ name = "password", id, autoComplete = "current-password", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id ?? name} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} className="input pr-11" {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-text"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
      >
        <Icon name={show ? "eyeOff" : "eye"} className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

export function Field({
  label,
  name,
  hint,
  children,
}: {
  label: string;
  name: string;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
