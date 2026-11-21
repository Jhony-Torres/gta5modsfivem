import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/misc";

export default async function Logs() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { email: true } } } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Registro de ações administrativas</h1>
      <div className="card overflow-x-auto">
        <table className="admin-table">
          <thead><tr><th>Data</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, true)}</td>
                <td className="text-xs">{l.actor?.email ?? "sistema"}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="text-xs">{l.entity} {l.entityId}</td>
                <td className="max-w-96 break-all font-mono text-[11px] text-muted">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
