// Internet discovery providers. Pure fetch/classify logic, no database access, so
// another search provider can be added (or the module moved to a worker) without
// touching the document pipeline.

export type PostType = "pgt_computer_science" | "computer_teacher";
export type ArtifactType =
  | "question_paper" | "answer_key" | "response_sheet" | "question_video"
  | "memory_based_questions" | "solved_questions" | "syllabus" | "exam_notice"
  | "exam_schedule" | "cutoff" | "result" | "unknown";
export type SourceKind = "web" | "pdf" | "youtube" | "telegram" | "scribd" | "government" | "blog" | "prep_site" | "archive";

export interface DiscoveryHit {
  url: string;
  title: string | null;
  snippet: string | null;
}

export interface DiscoveryProvider {
  name: string;
  search(query: string, opts?: { limit?: number }): Promise<DiscoveryHit[]>;
}

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export class FirecrawlDiscoveryProvider implements DiscoveryProvider {
  name = "firecrawl";
  async search(query: string, opts: { limit?: number } = {}): Promise<DiscoveryHit[]> {
    const lovable = process.env["LOVABLE_API_KEY"];
    const fc = process.env["FIRECRAWL_API_KEY"];
    if (!lovable || !fc) throw new Error("Firecrawl is not connected (missing server credentials)");
    const res = await fetch(`${GATEWAY}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": fc,
      },
      body: JSON.stringify({ query, limit: opts.limit ?? 10, country: "IN" }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Firecrawl search failed [${res.status}]: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: unknown };
    const d = json.data as
      | { web?: Array<Record<string, string>>; news?: Array<Record<string, string>> }
      | Array<Record<string, string>>
      | undefined;
    const rows = Array.isArray(d) ? d : [...(d?.web ?? []), ...(d?.news ?? [])];
    return rows
      .filter((r) => typeof r["url"] === "string")
      .map((r) => ({ url: r["url"]!, title: r["title"] ?? null, snippet: r["description"] ?? r["snippet"] ?? null }));
  }
}

const POST_NAMES: Record<PostType, string[]> = {
  pgt_computer_science: ["OAVS PGT Computer Science", "OAVS PGT Comp Sc", "OAVS PGT CS"],
  computer_teacher: ["OAVS Computer Teacher", "OAVS Computer Science Teacher"],
};

export interface PlannedQuery { query: string; kind: string }

/** At least one query per required category; never a single query per year. */
export function planQueries(post: PostType, year: number): PlannedQuery[] {
  const [main, ...alts] = POST_NAMES[post];
  const q: PlannedQuery[] = [
    { kind: "exact", query: `${main} ${year} question paper` },
    { kind: "exact", query: `${main} ${year} previous paper` },
    ...alts.map((a) => ({ kind: "abbreviation", query: `${a} ${year} question paper` })),
    { kind: "pdf", query: `${main} ${year} question paper filetype:pdf` },
    { kind: "answer_key", query: `${main} ${year} answer key` },
    { kind: "response_sheet", query: `${main} ${year} response sheet` },
    { kind: "solved", query: `${main} ${year} solved paper previous questions` },
    { kind: "youtube", query: `${main} ${year} questions site:youtube.com` },
    { kind: "site", query: `Odisha Adarsha Vidyalaya ${post === "computer_teacher" ? "computer teacher" : "PGT computer science"} ${year} site:oav.edu.in` },
    { kind: "site", query: `${main} ${year} site:t.me OR site:scribd.com` },
    { kind: "notice", query: `OAVS ${post === "computer_teacher" ? "computer teacher" : "PGT"} recruitment ${year} exam date notice` },
  ];
  return q;
}

export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (u.hostname === "youtu.be") return `https://youtube.com/watch?v=${u.pathname.slice(1)}`;
  if (u.hostname === "youtube.com" && u.searchParams.get("v")) return `https://youtube.com/watch?v=${u.searchParams.get("v")}`;
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|si$)/i.test(k)) u.searchParams.delete(k);
  u.protocol = "https:";
  let s = u.toString();
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
  return s;
}

const OFFICIAL = /(^|\.)(oav\.edu\.in|ssbodisha\.ac\.in|odisha\.gov\.in|nic\.in|gov\.in)$/;
const PREP = /(testbook|adda247|oliveboard|examstocks|jagranjosh|careerpower|prepp|embibe|gradeup|byjus|safalta|odishaguru|odiagk|examsbook|sarkari)/;

export interface Classification {
  sourceDomain: string;
  sourceKind: SourceKind;
  postTypeGuess: PostType | "unknown";
  yearGuess: number | null;
  artifactTypeGuess: ArtifactType;
  authorityGuess: "official" | "secondary" | "memory_based" | "unknown";
  confidence: number;
  isDownloadable: boolean;
  relevant: boolean;
}

/** Heuristic hints only — never a final classification. Unknown stays unknown. */
export function classify(hit: DiscoveryHit, targetYear: number): Classification {
  const u = new URL(hit.url);
  const domain = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const hay = `${hit.title ?? ""} ${hit.snippet ?? ""} ${decodeURIComponent(u.pathname)}`.toLowerCase();
  const isPdf = /\.pdf($|\?)/i.test(hit.url);
  const kind: SourceKind =
    /youtube\.com|youtu\.be/.test(domain) ? "youtube"
    : domain === "t.me" || domain.endsWith("telegram.me") ? "telegram"
    : domain.includes("scribd.com") ? "scribd"
    : domain.includes("web.archive.org") ? "archive"
    : isPdf ? "pdf"
    : OFFICIAL.test(domain) ? "government"
    : PREP.test(domain) ? "prep_site"
    : /blogspot|wordpress|medium\.com/.test(domain) ? "blog"
    : "web";

  const post: Classification["postTypeGuess"] =
    /computer\s*teacher/.test(hay) && !/pgt/.test(hay) ? "computer_teacher"
    : /pgt/.test(hay) && /(computer|comp\.?\s*sc|\bcs\b)/.test(hay) ? "pgt_computer_science"
    : "unknown";

  const years = [...hay.matchAll(/\b(20[12]\d)\b/g)].map((m) => Number(m[1]));
  const yearGuess = years.includes(targetYear) ? targetYear : (years[0] ?? null);

  const isVideo = kind === "youtube";
  let art: ArtifactType = "unknown";
  if (/response\s*sheet/.test(hay)) art = "response_sheet";
  else if (/answer\s*key/.test(hay)) art = "answer_key";
  else if (/memory\s*based/.test(hay)) art = "memory_based_questions";
  else if (/solved/.test(hay)) art = "solved_questions";
  else if (isVideo && /question|pyq|paper|mcq/.test(hay)) art = "question_video";
  else if (/question\s*paper|previous\s*(year\s*)?paper|\bpyq|previous\s*questions/.test(hay)) art = "question_paper";
  else if (/cut\s*-?\s*off/.test(hay)) art = "cutoff";
  else if (/result|merit\s*list|selection\s*list/.test(hay)) art = "result";
  else if (/syllabus/.test(hay)) art = "syllabus";
  else if (/admit\s*card|exam\s*date|schedule|time\s*table/.test(hay)) art = "exam_schedule";
  else if (/notification|advertisement|advt|notice|recruitment/.test(hay)) art = "exam_notice";

  const authority: Classification["authorityGuess"] =
    OFFICIAL.test(domain) ? "official"
    : isVideo || kind === "telegram" || art === "memory_based_questions" ? "memory_based"
    : "secondary";

  const relevant = /\boavs?\b|adarsha\s*vidyalaya|oav\.edu\.in/.test(hay) || domain === "oav.edu.in";
  let c = 0.1;
  if (relevant) c += 0.3;
  if (post !== "unknown") c += 0.2;
  if (yearGuess === targetYear) c += 0.15;
  if (art !== "unknown") c += 0.15;
  if (authority === "official") c += 0.1;

  return {
    sourceDomain: domain,
    sourceKind: kind,
    postTypeGuess: post,
    yearGuess,
    artifactTypeGuess: art,
    authorityGuess: authority,
    confidence: Math.min(1, Number(c.toFixed(2))),
    isDownloadable: isPdf || /\.(docx?|zip)($|\?)/i.test(hit.url),
    relevant,
  };
}
