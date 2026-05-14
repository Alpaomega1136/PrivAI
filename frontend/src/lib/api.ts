const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function getModelHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health/model`);
  if (!response.ok) {
    throw new Error(`Model health check failed: ${response.status}`);
  }
  return response.json();
}
