"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const STRIPE_PAY =
  "https://buy.stripe.com/test_3cI9AUg0v2X3eP2ba4dQQ00";

export type JobStatus =
  | "idle"
  | "submitting"
  | "success"
  | "timeout"
  | "robots"
  | "too_large"
  | "not_html"
  | "rate_limit";

export type JobJson = {
  status: JobStatus;
  url?: string;
  emailMasked?: string;
  paid?: boolean;
  error?: string;
  jobId?: string;
};

const TERMINAL: ReadonlySet<JobStatus> = new Set([
  "success",
  "timeout",
  "robots",
  "too_large",
  "not_html",
  "rate_limit",
]);

const SAMPLE_HREF = "/sample/citeready-sample.zip";

type Props = {
  jobId: string;
  onIdle: () => void;
};

function applyPayload(prev: JobJson, data: JobJson): JobJson {
  let status = data.status ?? prev.status;
  if ((data.paid ?? prev.paid) !== false && status === "rate_limit") {
    status = "timeout";
  }
  return {
    status,
    url: data.url ?? prev.url,
    emailMasked: status === "success" ? data.emailMasked : undefined,
    paid: data.paid ?? prev.paid,
    error: data.error,
  };
}

export default function StatusPanel({ jobId, onIdle }: Props) {
  const [activeId, setActiveId] = useState(jobId);
  const [job, setJob] = useState<JobJson>({ status: "submitting", paid: true });
  const [serverError, setServerError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/job/${encodeURIComponent(activeId)}`, {
      cache: "no-store",
    });
    if (res.status >= 500) {
      setServerError(true);
      setJob((prev) => ({ ...prev, status: "timeout" }));
      return "stop" as const;
    }
    if (!res.ok) {
      return "again" as const;
    }
    const data = (await res.json()) as JobJson;
    const isServer = data.error === "server";
    setServerError(isServer);
    setJob((prev) => applyPayload(prev, data));
    const status =
      (data.paid !== false && data.status === "rate_limit")
        ? "timeout"
        : data.status;
    return TERMINAL.has(status) ? ("stop" as const) : ("again" as const);
  }, [activeId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const next = await poll();
        if (cancelled || next === "stop") return;
      } catch {
        if (cancelled) return;
        // keep polling through transient network errors
      }
      timer = setTimeout(tick, 1000);
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [poll, attempt]);

  const status = serverError ? "timeout" : job.status;

  useEffect(() => {
    titleRef.current?.focus();
  }, [status, serverError, job.emailMasked]);

  useEffect(() => {
    if (status !== "submitting") return;
    setSeconds(0);
    const start = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.min(12, Math.floor((Date.now() - start) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [status, attempt]);

  async function retrySameUrl() {
    setServerError(false);
    setJob((prev) => ({ ...prev, status: "submitting" }));
    setAttempt((n) => n + 1);
    const payload: { url?: string; jobId: string } = { jobId: activeId };
    if (job.url) payload.url = job.url;
    const body = JSON.stringify(payload);
    const headers = { "Content-Type": "application/json" };
    try {
      const retry = await fetch(
        `/api/job/${encodeURIComponent(activeId)}/retry`,
        { method: "POST", headers, body },
      );
      if (retry.ok) return;
      const gen = await fetch("/api/generate", {
        method: "POST",
        headers,
        body,
      });
      if (gen.status >= 500) {
        setServerError(true);
        setJob((prev) => ({ ...prev, status: "timeout" }));
        return;
      }
      if (!gen.ok) {
        setServerError(true);
        setJob((prev) => ({ ...prev, status: "timeout" }));
        return;
      }
      const data = (await gen.json()) as JobJson;
      if (typeof data.jobId === "string" && data.jobId) {
        setActiveId(data.jobId);
        const u = new URL(window.location.href);
        u.searchParams.set("job", data.jobId);
        u.hash = "generate";
        window.history.replaceState(
          null,
          "",
          `${u.pathname}${u.search}${u.hash}`,
        );
      }
      setJob((prev) => applyPayload(prev, data));
    } catch {
      setServerError(true);
      setJob((prev) => ({ ...prev, status: "timeout" }));
    }
  }

  const paid = job.paid !== false;
  const view = viewFor(status, job, serverError, paid);
  const live =
    view.role === "status" ? ("polite" as const) : undefined;

  return (
    <div
      className="status-panel"
      id="generate"
      role={view.role}
      aria-live={live}
    >
      <p className={`kicker${view.kickerClass ? ` ${view.kickerClass}` : ""}`}>
        {view.kicker}
      </p>
      <h2 ref={titleRef} tabIndex={-1}>
        {view.title}
      </h2>
      {job.url ? (
        <p className="url" title={job.url}>
          {job.url}
        </p>
      ) : null}
      <p>{view.body}</p>
      {view.progress ? (
        <div
          className="status-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={12}
          aria-valuenow={seconds}
          aria-label="Working, about 12 seconds."
        >
          <span className="visually-hidden">Working, about 12 seconds.</span>
          <i key={attempt} />
        </div>
      ) : null}
      {view.primary.type === "disabled" ? (
        <button className="btn" type="button" disabled aria-disabled="true">
          {view.primary.label}
        </button>
      ) : null}
      {view.primary.type === "idle" ? (
        <button className="btn" type="button" onClick={onIdle}>
          {view.primary.label}
        </button>
      ) : null}
      {view.primary.type === "retry" ? (
        <button className="btn" type="button" onClick={() => void retrySameUrl()}>
          {view.primary.label}
        </button>
      ) : null}
      {view.primary.type === "stripe" ? (
        <form method="GET" action={STRIPE_PAY}>
          {job.url ? (
            <input type="hidden" name="url" value={job.url} />
          ) : null}
          <button className="btn" type="submit">
            {view.primary.label}
          </button>
        </form>
      ) : null}
      {view.secondary?.type === "idle" ? (
        <button className="sec" type="button" onClick={onIdle}>
          {view.secondary.label}
        </button>
      ) : null}
      {view.secondary?.type === "link" ? (
        <a className="sec" href={view.secondary.href}>
          {view.secondary.label}
        </a>
      ) : null}
    </div>
  );
}

type Primary =
  | { type: "disabled"; label: string }
  | { type: "idle"; label: string }
  | { type: "retry"; label: string }
  | { type: "stripe"; label: string };

type Secondary =
  | { type: "idle"; label: string }
  | { type: "link"; label: string; href: string };

function viewFor(
  status: JobStatus,
  job: JobJson,
  serverError: boolean,
  paid: boolean,
): {
  role: "status" | "alert";
  kicker: string;
  kickerClass: string;
  title: string;
  body: string;
  progress?: boolean;
  primary: Primary;
  secondary?: Secondary;
} {
  if (status === "submitting") {
    return {
      role: "status",
      kicker: "Working",
      kickerClass: "",
      title: "Fetching your page",
      body: "This usually takes about 12 seconds. We honor robots.txt. No login.",
      progress: true,
      primary: { type: "disabled", label: "Working…" },
    };
  }
  if (status === "success") {
    return {
      role: "status",
      kicker: "Sent",
      kickerClass: "ok",
      title: "Pack is on its way",
      body: job.emailMasked
        ? `We emailed the zip to ${job.emailMasked}. Check spam if it is not there in a minute.`
        : "We emailed the zip to the address from checkout. Check spam if it is not there in a minute.",
      primary: { type: "idle", label: "Generate another URL" },
      secondary: {
        type: "link",
        label: "Download the sample pack",
        href: SAMPLE_HREF,
      },
    };
  }

  const alert = {
    role: "alert" as const,
    kicker: "Couldn’t fetch",
    kickerClass: "bad",
  };

  if (status === "timeout") {
    let body: string;
    if (serverError) {
      body =
        "Something went wrong on our side. Your payment still covers a retry.";
    } else if (paid) {
      body =
        "We stopped after 12 seconds. Your payment still covers a retry. Try a simpler public HTML page.";
    } else {
      body =
        "We stopped after 12 seconds. Try a simpler public HTML page.";
    }
    return {
      ...alert,
      title: "That page took too long",
      body,
      primary: { type: "retry", label: "Try this URL again" },
      secondary: { type: "idle", label: "Use a different URL" },
    };
  }

  if (status === "robots") {
    return {
      ...alert,
      title: "robots.txt blocked this fetch",
      body: "We honor robots.txt, so we will not fetch this URL. Try a public page that allows crawlers. Your payment still covers a retry if you already checked out.",
      primary: { type: "idle", label: "Use a different URL" },
    };
  }

  if (status === "too_large") {
    return {
      ...alert,
      title: "This HTML is larger than 1.5 MB",
      body: "We only fetch pages under 1.5 MB. Try a specific article or pricing page, not a dump. Your payment still covers a retry if you already checked out.",
      primary: { type: "idle", label: "Use a different URL" },
    };
  }

  if (status === "not_html") {
    return {
      ...alert,
      title: "We need a public HTML page",
      body: "That URL is not public HTML (login wall, PDF, or not HTML). We do not log in, scrape Maps, or connect a store. Your payment still covers a retry if you already checked out.",
      primary: { type: "idle", label: "Use a different URL" },
    };
  }

  return {
    ...alert,
    title: "Free preview limit reached",
    body: "You can preview 3 URLs per day without paying. Checkout for $19 to generate this pack, or try again tomorrow.",
    primary: { type: "stripe", label: "Generate my pack — $19" },
    secondary: {
      type: "link",
      label: "Download the sample pack",
      href: SAMPLE_HREF,
    },
  };
}
