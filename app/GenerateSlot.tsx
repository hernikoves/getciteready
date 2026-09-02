"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusPanel from "./StatusPanel";
import { startCheckout } from "./start-checkout";

export function IdleForm() {
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const url = String(new FormData(form).get("url") ?? "").trim();
    if (!url) return;
    setBusy(true);
    try {
      const checkoutUrl = await startCheckout(url);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="gen" id="generate" onSubmit={onSubmit}>
        <label htmlFor="url">Public page URL</label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://yoursite.com/pricing"
          autoComplete="url"
          inputMode="url"
        />
        <p className="hint">
          Zip arrives by email after checkout. No account.
        </p>
        <button className="btn" type="submit" disabled={busy}>
          Generate my pack — $19
        </button>
      </form>
      <a className="sec" href="/sample/citeready-sample.zip">
        Download the sample pack
      </a>
    </>
  );
}

export default function GenerateSlot() {
  const searchParams = useSearchParams();
  const jobFromUrl = searchParams.get("job");
  const [cleared, setCleared] = useState(false);
  const jobId = cleared ? null : jobFromUrl;

  useEffect(() => {
    setCleared(false);
  }, [jobFromUrl]);

  useEffect(() => {
    if (!jobId) return;
    if (window.location.hash !== "#generate") {
      const { pathname, search } = window.location;
      window.history.replaceState(null, "", `${pathname}${search}#generate`);
    }
  }, [jobId]);

  function onIdle() {
    setCleared(true);
    const { pathname } = window.location;
    window.history.replaceState(null, "", `${pathname}#generate`);
  }

  if (jobId) {
    return <StatusPanel jobId={jobId} onIdle={onIdle} />;
  }
  return <IdleForm />;
}
