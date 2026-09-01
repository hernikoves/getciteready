export function getSiteUrl(): string {
  const raw =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  if (!raw) return "https://getciteready.vercel.app";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}
