export function backendBaseUrl(): string {
  const raw = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}
