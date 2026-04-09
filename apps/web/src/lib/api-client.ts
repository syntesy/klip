const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const { getToken } = await import("@clerk/nextjs/server").then((m) => m.auth());

  const token = await (getToken as () => Promise<string | null>)();

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

export const apiClient = {
  get: (path: string) => fetchWithAuth(path),
  post: (path: string, body: unknown) =>
    fetchWithAuth(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    fetchWithAuth(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => fetchWithAuth(path, { method: "DELETE" }),
};
