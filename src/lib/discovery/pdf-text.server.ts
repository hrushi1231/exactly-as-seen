import { getDocumentProxy } from "unpdf";

/** Text of the first few pages only (metadata/basic checks, not question extraction). */
export async function firstPagesText(bytes: Uint8Array, maxPages = 3): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const out: string[] = [];
    for (let i = 1; i <= Math.min(maxPages, pdf.numPages); i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    return out.join("\n").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}
