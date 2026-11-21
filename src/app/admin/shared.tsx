export function DeleteButton({ action, kind, id, label = "Excluir" }: { action: (fd: FormData) => Promise<void>; kind: string; id: string; label?: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger px-3 py-1.5 text-xs">{label}</button>
    </form>
  );
}

export const toLocalInput = (d: Date | null | undefined) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
