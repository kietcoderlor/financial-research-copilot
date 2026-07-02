import type { QueryCitation } from "@/lib/apiClient";

export function formatAnswerMarkdown(answer: string, citations: QueryCitation[]): string {
  const lines = [answer.trim(), "", "## Sources", ""];
  for (const c of citations) {
    const meta = [c.company, c.doc_type, c.year != null ? String(c.year) : null, c.section]
      .filter(Boolean)
      .join(" · ");
    lines.push(`### [${c.index}] ${meta}`);
    lines.push("");
    lines.push(`> ${c.excerpt.replace(/\n/g, " ")}`);
    if (c.source_url) {
      lines.push("");
      lines.push(`[View filing](${c.source_url})`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export async function copyAnswerMarkdown(answer: string, citations: QueryCitation[]): Promise<void> {
  const text = formatAnswerMarkdown(answer, citations);
  await navigator.clipboard.writeText(text);
}
