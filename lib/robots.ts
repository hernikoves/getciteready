export type RobotsResult = "allow" | "disallow" | "skip";

type Rule = { allow: boolean; prefix: string };

function matchAgent(uaLine: string, ourUa: string): boolean {
  const name = uaLine.slice(uaLine.indexOf(":") + 1).trim().toLowerCase();
  if (name === "*") return true;
  const ours = ourUa.toLowerCase();
  return ours.startsWith(name) || name === "citeready";
}

function pathAllowed(pathAndQuery: string, rules: Rule[]): boolean {
  let best: { n: number; allow: boolean } | undefined;
  for (const r of rules) {
    const p = r.prefix;
    if (!p) {
      continue;
    }
    const escaped = p.replace(/[+.?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const re = new RegExp("^" + escaped);
    if (re.test(pathAndQuery)) {
      if (!best || p.length > best.n) best = { n: p.length, allow: r.allow };
    }
  }
  if (!best) return true;
  return best.allow;
}

export function robotsAllows(
  robotsTxt: string,
  pathAndQuery: string,
  ourUa: string
): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | undefined;
  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!cur || cur.rules.length > 0) {
        cur = { agents: [val], rules: [] };
        groups.push(cur);
      } else {
        cur.agents.push(val);
      }
    } else if (key === "disallow" || key === "allow") {
      if (!cur) {
        cur = { agents: ["*"], rules: [] };
        groups.push(cur);
      }
      cur.rules.push({ allow: key === "allow", prefix: val });
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => matchAgent("user-agent: " + a, ourUa) && a.trim() !== "*")
  );
  const star = groups.filter((g) => g.agents.some((a) => a.trim() === "*"));
  const chosen = specific.length ? specific : star;
  if (!chosen.length) return true;
  const rules = chosen.flatMap((g) => g.rules);
  return pathAllowed(pathAndQuery, rules);
}

export function isPathAllowed(robotsTxt: string, pathAndQuery: string): boolean {
  return robotsAllows(
    robotsTxt,
    pathAndQuery || "/",
    process.env.CITEREADY_USER_AGENT || "CiteReady/1.0 (+https://getciteready.vercel.app)"
  );
}
