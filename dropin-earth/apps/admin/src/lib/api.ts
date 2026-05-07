export const apiBaseUrl = process.env.NEXT_PUBLIC_DROPIN_API_URL ?? "http://localhost:8787";

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export async function getApi<T>(path: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }
  return payload.data;
}
