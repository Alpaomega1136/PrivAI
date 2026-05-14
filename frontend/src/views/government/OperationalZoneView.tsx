import { Database, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Panel } from "../../components/ui/Panel";
import { SecureViewer } from "../../components/ui/SecureViewer";
import { ApiResult, buildBackendFileUrl } from "../../lib/api";
import { formatWibDate } from "../../lib/format";

// ╔═══ ASSET PAGE INI — ubah di sini ═══╗
// Taruh file di src/assets/ lalu uncomment import & isi nama file.
// import banner from "../../assets/operational-zone-banner.png";
const PAGE_ASSETS = {
  banner: "" as string, // banner gambar di atas halaman; "" = tidak ditampilkan
};
// ╚══════════════════════════════════════╝

export function OperationalZoneView({
  recordsResult,
}: {
  recordsResult: ApiResult<{ records: Array<Record<string, unknown>> } & Record<string, unknown>>;
}) {
  const records = recordsResult.data?.records ?? [];
  const [viewerUrl, setViewerUrl] = useState("");

  function getRedactedUrl(record: Record<string, unknown>) {
    return buildBackendFileUrl(String(record.redacted_url ?? record.redacted_file_url ?? ""));
  }

  return (
    <div className="view-stack">
      {viewerUrl && (
        <SecureViewer
          url={viewerUrl}
          title="Pratinjau Dokumen Tersensor"
          onClose={() => setViewerUrl("")}
          isSensitive={false}
        />
      )}

      <Panel title="Daftar Dokumen Redacted" eyebrow="Operational Data" icon={<Database />}>
        <div className="alert-card success">
          <ShieldCheck size={24} color="var(--success)" />
          <div>
            <strong>Penyimpanan Aman</strong>
            <p>
              Original tidak disimpan di Operational Zone. Hanya file yang telah diredaksi visual dan metadata
              non-sensitif yang tersedia di sini.
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="empty-state">Belum ada dokumen yang diproses.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Original Filename</th>
                  <th>Profile / Mode</th>
                  <th>Stats</th>
                  <th>Dibuat Pada</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const redactedUrl = getRedactedUrl(record);
                  return (
                    <tr key={String(record.record_id)}>
                      <td>
                        <strong>{String(record.record_id).substring(0, 8)}...</strong>
                      </td>
                      <td>
                        {String(record.original_filename ?? "-")}
                        {Boolean(record.redacted_filename) && (
                          <small>Redacted: {String(record.redacted_filename)}</small>
                        )}
                      </td>
                      <td>
                        <div className="badge muted">{String(record.redaction_profile ?? "-")}</div>
                        <div className="badge muted" style={{ marginLeft: "4px" }}>
                          {String(record.redaction_mode ?? "-")}
                        </div>
                      </td>
                      <td>
                        <small>{Number(record.detection_count ?? 0)} deteksi</small>
                        <small>{Number(record.redacted_count ?? 0)} diredaksi</small>
                      </td>
                      <td>
                        <small>{formatWibDate(record.created_at)} WIB</small>
                      </td>
                      <td>
                        {redactedUrl ? (
                          <div className="table-actions">
                            <button
                              type="button"
                              className="primary-button secondary-button compact-button"
                              onClick={() => setViewerUrl(redactedUrl)}
                            >
                              Preview
                            </button>
                          </div>
                        ) : (
                          <span className="badge muted">Tidak tersedia</span>
                        )}
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
