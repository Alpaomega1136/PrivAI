import { Activity, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Field } from "../../components/ui/Field";
import { NumericInput } from "../../components/ui/NumericInput";
import { Panel } from "../../components/ui/Panel";
import { ApiResult, AuditLog, AuditLogFilters, getAuditLogs, safeRequest } from "../../lib/api";
import { formatWibDate } from "../../lib/format";

export function AuditLogView({
  initialLogs,
}: {
  initialLogs: ApiResult<{ logs: AuditLog[]; count: number }>;
}) {
  const [filters, setFilters] = useState<
    Required<Pick<AuditLogFilters, "limit" | "recordId" | "zone" | "eventType">>
  >({ limit: 50, recordId: "", zone: "", eventType: "" });
  const [result, setResult] = useState(initialLogs);

  useEffect(() => {
    setResult(initialLogs);
  }, [initialLogs]);

  const logs = result.data?.logs ?? [];

  return (
    <div className="view-stack">
      <Panel title="Pencarian Log" eyebrow="Audit Trail" icon={<Activity />}>
        <div className="form-grid">
          <Field label="Limit Maksimal">
            <NumericInput
              min={1}
              max={200}
              value={filters.limit}
              fallbackValue={50}
              onValueChange={(value) => setFilters({ ...filters, limit: value })}
            />
          </Field>
          <Field label="Filter Record ID">
            <input
              value={filters.recordId}
              onChange={(e) => setFilters({ ...filters, recordId: e.target.value })}
              placeholder="Opsional"
            />
          </Field>
          <Field label="Zone">
            <select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
              <option value="">Semua Zone</option>
              <option value="Sovereign Vault">Sovereign Vault</option>
              <option value="Operational Zone">Operational Zone</option>
              <option value="Government Access API">Government Access API</option>
              <option value="Dynamic Injection">Dynamic Injection</option>
            </select>
          </Field>
          <Field label="Event Type">
            <input
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              placeholder="Opsional"
            />
          </Field>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={async () => setResult(await safeRequest(() => getAuditLogs(filters)))}
          style={{ marginTop: "16px" }}
        >
          Terapkan Filter
        </button>
      </Panel>

      <Panel title="Daftar Peristiwa Keamanan" eyebrow={`Menampilkan ${logs.length} event`} icon={<ShieldCheck />}>
        {logs.length === 0 ? (
          <div className="empty-state">Tidak ada event audit yang sesuai filter.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Zone</th>
                  <th>Actor</th>
                  <th>Record ID</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  let badgeClass = "muted";
                  if (log.zone === "Sovereign Vault") badgeClass = "green";
                  if (log.zone === "Operational Zone") badgeClass = "copper";
                  if (log.zone === "Government Access API") badgeClass = "danger";
                  if (log.zone === "Dynamic Injection") badgeClass = "brown";

                  return (
                    <tr key={log.id}>
                      <td>
                        <strong>{log.event_type}</strong>
                        <small>{log.action}</small>
                      </td>
                      <td>
                        <div className={`badge ${badgeClass}`}>{log.zone}</div>
                      </td>
                      <td>{log.actor}</td>
                      <td>{log.record_id ? String(log.record_id).substring(0, 8) + "..." : "-"}</td>
                      <td>
                        <small>{formatWibDate(log.created_at)} WIB</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
