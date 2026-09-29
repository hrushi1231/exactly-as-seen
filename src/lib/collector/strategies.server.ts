// Collector strategies. Pure fetch/parse logic with no database access, so the same
// module can be lifted into a standalone Node.js worker later.

export type StrategyName = "direct_file" | "static_html" | "browser";

export const USER_AGENT =
  "PGTCSWorkbench-Collector/1.0 (+public document archival; respects robots.txt)";
const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png)(?:$|[?#])/i;
const FILE_MIME = /(application\/(pdf|msword|vnd\.|zip|x-rar|octet-stream))|image\//i;

export interface InspectResult {
  url: string;
  finalUrl: string;
  kind: "direct_file" | "html" | "unknown";
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  error?: string;
}

export interface CandidateLink {
  url: string;
  anchorText: string;
  detectedFileType: string | null;
  possibleYear: number | null;
  possibleDocumentType: string | null;
  confidence: number;
}

export interface DownloadedFile {
  finalUrl: string;
  bytes: Uint8Array;
  sha256: string;
  mimeType: string;
  fileSize: number;
  filename: string;
  pageCount: number | null;
}

export interface CollectorStrategy {
  name: StrategyName;
  /** Discover candidate links from a page (static_html / browser). */
  discover?(url: string): Promise<CandidateLink[]>;
  /** Download a single file (direct_file). */
  download?(url: string): Promise<DownloadedFile>;
}

async function timedFetch(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs are allowed");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "[::1]"
  )
    throw new Error("Private or local addresses are not allowed");
  return u;
}

/** Minimal robots.txt check for the `*` user-agent group. */
export async function robotsAllows(raw: string): Promise<{ allowed: boolean; note: string }> {
  const u = new URL(raw);
  try {
    const res = await timedFetch(`${u.origin}/robots.txt`);
    if (!res.ok) return { allowed: true, note: `robots.txt unavailable (${res.status})` };
    const text = await res.text();
    let applies = false;
    const disallow: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const [k, ...rest] = line.split(":");
      const key = k?.trim().toLowerCase();
      const val = rest.join(":").trim();
      if (key === "user-agent") applies = val === "*";
      else if (applies && key === "disallow" && val) disallow.push(val);
    }
    const blocked = disallow.find((p) => u.pathname.startsWith(p));
    return blocked
      ? { allowed: false, note: `robots.txt disallows ${blocked}` }
      : { allowed: true, note: "robots.txt permits this path" };
  } catch (e) {
    return { allowed: true, note: `robots.txt check failed: ${(e as Error).message}` };
  }
}

export async function inspectUrl(raw: string): Promise<InspectResult> {
  const u = assertPublicHttpUrl(raw);
  const base: InspectResult = { url: raw, finalUrl: raw, kind: "unknown", status: null, contentType: null, contentLength: null };
  try {
    let res = await timedFetch(u.toString(), { method: "HEAD" });
    if (res.status === 405 || res.status === 403 || !res.headers.get("content-type")) {
      res = await timedFetch(u.toString(), { method: "GET", headers: { range: "bytes=0-1023" } });
      await res.body?.cancel();
    }
    const ct = res.headers.get("content-type");
    const len = Number(res.headers.get("content-length")) || null;
    const kind: InspectResult["kind"] =
      (ct && FILE_MIME.test(ct)) || FILE_EXT.test(res.url || raw)
        ? "direct_file"
        : ct?.includes("text/html")
          ? "html"
          : "unknown";
    return { ...base, finalUrl: res.url || raw, kind, status: res.status, contentType: ct, contentLength: len };
  } catch (e) {
    return { ...base, error: (e as Error).message };
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Heuristic hints only. Never treated as a final classification. */
export function guessMeta(text: string, url: string) {
  const hay = `${text} ${decodeURIComponent(url)}`.toLowerCase();
  const year = hay.match(/\b(20[0-3]\d|19[89]\d)\b/);
  let type: string | null = null;
  if (/answer\s*key|final\s*key|provisional\s*key/.test(hay)) type = "answer_key";
  else if (/response\s*sheet/.test(hay)) type = "response_sheet";
  else if (/question\s*(paper|booklet)|\bqp\b/.test(hay)) type = "question_paper";
  else if (/syllabus|annexure/.test(hay)) type = "syllabus";
  else if (/pattern|scheme\s*of\s*exam/.test(hay)) type = "exam_pattern";
  else if (/notification|advertisement|advt|notice|recruitment/.test(hay)) type = "notification";
  else if (/memory\s*based/.test(hay)) type = "memory_based_paper";
  let confidence = 0.2;
  if (FILE_EXT.test(url)) confidence += 0.2;
  if (type) confidence += 0.2;
  if (/pgt/.test(hay)) confidence += 0.15;
  if (/computer\s*science|\bcs\b|comp\.?\s*sc/.test(hay)) confidence += 0.2;
  return {
    possibleYear: year ? Number(year[1]) : null,
    possibleDocumentType: type,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}

export const staticHtmlStrategy: CollectorStrategy = {
  name: "static_html",
  async discover(pageUrl) {
    assertPublicHttpUrl(pageUrl);
    const res = await timedFetch(pageUrl);
    if (!res.ok) throw new Error(`Page returned HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) throw new Error(`Not an HTML page (${ct || "no content-type"})`);
    const html = await res.text();
    const base = res.url || pageUrl;
    const out = new Map<string, CandidateLink>();
    const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const href = decodeEntities(m[1]!.trim());
      if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
      let abs: string;
      try {
        abs = new URL(href, base).toString();
      } catch {
        continue;
      }
      const ext = abs.match(FILE_EXT)?.[1]?.toLowerCase() ?? null;
      if (!ext) continue; // only document-like links become candidates
      const text = decodeEntities(m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 300);
      if (!out.has(abs)) out.set(abs, { url: abs, anchorText: text, detectedFileType: ext, ...guessMeta(text, abs) });
    }
    return [...out.values()];
  },
};

function countPdfPages(bytes: Uint8Array): number | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
  if (head !== "%PDF-") return null;
  const text = new TextDecoder("latin1").decode(bytes);
  const n = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  return n > 0 ? n : null;
}

export const directFileStrategy: CollectorStrategy = {
  name: "direct_file",
  async download(url) {
    assertPublicHttpUrl(url);
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`Download returned HTTP ${res.status}`);
    const declared = Number(res.headers.get("content-length"));
    if (declared && declared > MAX_BYTES) throw new Error(`File too large (${declared} bytes)`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error(`File too large (${buf.byteLength} bytes)`);
    const ct = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim();
    if (ct.includes("text/html")) throw new Error("URL returned an HTML page, not a file");
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const finalUrl = res.url || url;
    const cd = res.headers.get("content-disposition");
    const fromCd = cd?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
    const filename = decodeURIComponent(fromCd ?? new URL(finalUrl).pathname.split("/").pop() ?? "file") || "file";
    return { finalUrl, bytes: buf, sha256, mimeType: ct, fileSize: buf.byteLength, filename, pageCount: countPdfPages(buf) };
  },
};

/**
 * Browser strategy boundary. Headless Chromium cannot run in the web app's
 * serverless runtime; an external Node.js worker implements this interface and
 * writes results through the same tables (collection_runs / candidate_links).
 */
export const browserStrategy: CollectorStrategy = {
  name: "browser",
  async discover() {
    throw new Error(
      "Browser collection requires the external collector worker, which is not deployed yet.",
    );
  },
};
