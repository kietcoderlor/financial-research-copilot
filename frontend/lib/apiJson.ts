export async function parseJsonResponse<T = Record<string, unknown>>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function authServiceUnavailableMessage(status?: number): string {
  if (status === 503 || status === 502) {
    return "Cannot reach the API. Start the backend (docker compose up or uvicorn on port 8000).";
  }
  return "Auth service returned an invalid response. Check that the backend is running.";
}
