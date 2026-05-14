import { Database, KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Panel } from "../../components/ui/Panel";
import { ApiResult, getVaultRecord, rotateVaultKey, safeRequest } from "../../lib/api";
import { formatWibDate } from "../../lib/format";

export function SovereignVaultView({
  records,
  keyInfo,
}: {
  records: Array<Record<string, unknown>>;
  keyInfo: ApiResult<Record<string, unknown>>;
}) {
  const [recordId, setRecordId] = useState(String(records[0]?.record_id ?? ""));
  const [cryptoAdminToken, setCryptoAdminToken] = useState("privai-crypto-admin-demo-token");
  const [vaultResult, setVaultResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [rotateResult, setRotateResult] = useState<ApiResult<Record<string, unknown>> | null>(null);
  const [search, setSearch] = useState("");

  const kInfo = keyInfo.data as Record<string, unknown> | undefined;

  const filteredRecords = records.filter((r) => {
    const rId = String(r.record_id ?? "").toLowerCase();
    const fName = String(r.original_filename ?? "").toLowerCase();
    const s = search.toLowerCase();
    return rId.includes(s) || fName.includes(s);
  });

  async function handleRowClick(id: string) {
    setRecordId(id);
    const result = await safeRequest(() => getVaultRecord(id));
    setVaultResult(result);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="view-stack">
      <div className="two-column">
        <Panel title="Status Enkripsi" eyebrow="Sovereign Vault" icon={<LockKeyhole />}>
          <div className="alert-card warning">
            <LockKeyhole size={24} color="var(--warning)" />
            <div>
              <strong>Security Protocol</strong>
              <p>
                Private key tidak pernah dikirim ke User Zone atau Operational Zone. Semua enkripsi/dekripsi dilakukan
                secara lokal di backend.
              </p>
            </div>
          </div>

          <div className="key-value-list">
            <div className="key-value-item">
              <span>Active Key Version</span>
              <strong>{String(kInfo?.active_version ?? "-")}</strong>
            </div>
            <div className="key-value-item">
              <span>Key ID</span>
              <strong>{String(kInfo?.key_id ?? "-")}</strong>
            </div>
            <div className="key-value-item">
              <span>Algoritma Simetris</span>
              <strong>AES-256-GCM</strong>
            </div>
            <div className="key-value-item">
              <span>Pembungkusan Kunci</span>
              <strong>RSA-OAEP-SHA256</strong>
            </div>
            <div className="key-value-item">
              <span>Public Fingerprint</span>
              <strong>{String(kInfo?.public_fingerprint ?? "-")}</strong>
            </div>
          </div>
        </Panel>

        <div style={{ display: "grid", gap: "24px", alignContent: "start" }}>
          <Panel title="Rotasi Kunci (Admin Crypto)" eyebrow="Maintenance" icon={<KeyRound />}>
            <div className="inline-form" style={{ marginTop: 0 }}>
              <input
                value={cryptoAdminToken}
                onChange={(e) => setCryptoAdminToken(e.target.value)}
                type="password"
                placeholder="Admin Token"
              />
              <button
                type="button"
                className="primary-button secondary-button"
                onClick={async () => setRotateResult(await safeRequest(() => rotateVaultKey(cryptoAdminToken)))}
              >
                Rotasi Kunci
              </button>
            </div>
            {rotateResult && (
              <div className={`result-box ${rotateResult.ok ? "success-box" : "error-box"}`}>
                {rotateResult.ok ? "Rotasi kunci berhasil diinisiasi." : "Gagal merotasi kunci."}
              </div>
            )}
          </Panel>

          <Panel title="Detail Metadata Vault" eyebrow="Lookup" icon={<Database />}>
            <div className="inline-form" style={{ marginTop: 0 }}>
              <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="Masukkan Record ID" />
              <button
                type="button"
                className="primary-button"
                onClick={async () => setVaultResult(await safeRequest(() => getVaultRecord(recordId)))}
              >
                Cari Manual
              </button>
            </div>
            {vaultResult && (
              <div className="result-box">
                {vaultResult.ok ? (
                  <div className="key-value-list">
                    <div className="key-value-item">
                      <span>Record ID</span>
                      <strong>{String(vaultResult.data?.record_id ?? "-")}</strong>
                    </div>
                    <div className="key-value-item">
                      <span>Encrypted Blob</span>
                      <strong>Tersedia ({Number(vaultResult.data?.encrypted_blob_size ?? 0)} bytes)</strong>
                    </div>
                    <div className="key-value-item">
                      <span>Key Version</span>
                      <strong>{String(vaultResult.data?.key_version ?? "-")}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="error-box" style={{ padding: "12px", borderRadius: "8px" }}>
                    {vaultResult.error?.message || "Data tidak ditemukan"}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Daftar Dokumen di Vault" eyebrow="Vault Records" icon={<Database />}>
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Cari berdasarkan Record ID atau Filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: "400px" }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Original Filename</th>
                <th>Terenkripsi</th>
                <th>Dibuat Pada</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={String(record.record_id)}>
                  <td>
                    <strong>{String(record.record_id).substring(0, 8)}...</strong>
                  </td>
                  <td>{String(record.original_filename ?? "-")}</td>
                  <td>
                    {record.vault_encrypted ? (
                      <span className="badge green">Ya</span>
                    ) : (
                      <span className="badge danger">Tidak</span>
                    )}
                  </td>
                  <td>
                    <small>{formatWibDate(record.created_at)} WIB</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="primary-button secondary-button"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => handleRowClick(String(record.record_id))}
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                    Tidak ada record yang sesuai dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
