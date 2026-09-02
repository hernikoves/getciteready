/** Best-effort zip delivery. No-ops when RESEND_API_KEY or RESEND_FROM is unset. */
export async function emailZip(opts: {
  to: string;
  zip: Uint8Array;
  url: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from || !opts.to) return false;
  const b64 = Buffer.from(opts.zip).toString("base64");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: "Your CiteReady pack",
        text: `The zip for ${opts.url} is attached.`,
        attachments: [{ filename: "citeready-pack.zip", content: b64 }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
