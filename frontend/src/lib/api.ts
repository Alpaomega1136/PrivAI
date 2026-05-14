const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type HealthResponse = {
  status: string;
  app: string;
  model_loaded: boolean;
  model_exists: boolean;
  device: string;
  operational_zone: string;
  sovereign_vault: string;
  database: string;
};

export type AuditLog = {
  id: number;
  record_id: string | null;
  zone: string;
  event_type: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string | null;
};

export type AuditLogsResponse = {
  logs: AuditLog[];
  count: number;
  filters: Record<string, unknown>;
};

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getHealth() {
  return requestJson<HealthResponse>("/api/health");
}

export function getAuditLogs({ limit = 20 }: { limit?: number } = {}) {
  return requestJson<AuditLogsResponse>(`/api/audit-logs?limit=${limit}`);
}
