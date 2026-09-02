export async function startCheckout(url: string): Promise<string | null> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: unknown };
  return typeof data.url === "string" && data.url ? data.url : null;
}
