/** Close dangling markdown delimiters so partial stream renders as formatted text, not raw syntax. */
export function prepareStreamingMarkdown(text: string): string {
  let out = text;

  const boldPairs = (out.match(/\*\*/g) || []).length;
  if (boldPairs % 2 === 1) {
    out += "**";
  }

  // Lone trailing asterisk (not part of **)
  if (/(?<!\*)\*(?!\*)$/.test(out)) {
    out = out.replace(/(?<!\*)\*(?!\*)$/, "");
  }

  // Incomplete citation bracket: [12
  const lastOpen = out.lastIndexOf("[");
  const lastClose = out.lastIndexOf("]");
  if (lastOpen > lastClose) {
    const tail = out.slice(lastOpen);
    if (/^\[\d*$/.test(tail)) {
      out += "]";
    }
  }

  return out;
}
