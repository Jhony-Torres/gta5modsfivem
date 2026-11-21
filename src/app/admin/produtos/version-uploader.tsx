"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/forms";
import { Icon } from "@/components/icons";
import { createVersionAction } from "../actions/products";

type Uploaded = { id: string; name: string; size: number; sha256: string };

/** Envio do arquivo privado em streaming (com progresso) e criação da versão. */
export function VersionUploader({ productId }: { productId: string }) {
  const [file, setFile] = useState<Uploaded | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await createVersionAction(prev, fd);
    if (r?.ok) {
      setFile(null);
      formRef.current?.reset();
    }
    return r;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  function upload(f: File) {
    setErr(null);
    setFile(null);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/admin/upload");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(f.name));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200) setFile(data);
        else setErr(data.error || "Falha no envio.");
      } catch {
        setErr(`Falha no envio (HTTP ${xhr.status}).`);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setErr("Erro de conexão durante o envio.");
    };
    xhr.send(f);
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="fileId" value={file?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="version">Número da versão *</label>
          <input id="version" name="version" required maxLength={40} placeholder="1.0.0" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="vfile">Arquivo (privado)</label>
          <input
            id="vfile"
            type="file"
            accept=".zip,.rar,.7z,.oiv,.rpf,.lua,.txt,.pdf"
            className="input"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            disabled={progress !== null}
          />
          <p className="hint">Formatos: zip, rar, 7z, oiv, rpf, lua, txt, pdf. O arquivo nunca fica em pasta pública.</p>
        </div>
      </div>
      {progress !== null && (
        <div role="status" className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-surface-3"><div className="h-full bg-sun transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="flex items-center gap-2 text-xs text-muted"><Icon name="spinner" className="h-3 w-3" /> Enviando... {progress}%</p>
        </div>
      )}
      {file && (
        <p className="flex items-center gap-2 text-sm text-ok" role="status">
          <Icon name="check" className="h-4 w-4" /> {file.name} enviado ({(file.size / 1048576).toFixed(2)} MB) · SHA-256 {file.sha256.slice(0, 12)}…
        </p>
      )}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div>
        <label className="label" htmlFor="changelog">Alterações desta versão</label>
        <textarea id="changelog" name="changelog" rows={3} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makeCurrent" defaultChecked /> Definir como versão atual</label>
      <SubmitButton pendingText="Criando versão..." disabled={progress !== null}>Criar versão</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
