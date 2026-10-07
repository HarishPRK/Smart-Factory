import React from "react";

/** A small Markdown reader: no HTML execution or arbitrary URL schemes. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return /^https?:\/\/[^\s]+$/i.test(link[2]) ? <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : <React.Fragment key={index}>{link[1]}</React.Fragment>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
const listItem = (line: string) => line.match(/^\s*(?:(\d+)[.)]|([-*]))\s+(.+)$/);
const tableCells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

export default function LanggraphResponse({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let position = 0;
  while (position < lines.length) {
    const line = lines[position];
    if (!line.trim()) { position++; continue; }
    const key = position;
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      position++;
      while (position < lines.length && !/^\s*```/.test(lines[position])) code.push(lines[position++]);
      if (position < lines.length) position++;
      blocks.push(<pre key={key}><code>{code.join("\n")}</code></pre>); continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) { blocks.push(<h4 key={key}>{inline(heading[1])}</h4>); position++; continue; }
    if (position + 1 < lines.length && line.includes("|") && isTableSeparator(lines[position + 1])) {
      const headings = tableCells(line);
      position += 2;
      const rows: string[][] = [];
      while (position < lines.length && lines[position].trim() && lines[position].includes("|")) rows.push(tableCells(lines[position++]));
      blocks.push(<div className="langgraph-response__table" key={key} tabIndex={0} role="region" aria-label="Agent response table"><table><thead><tr>{headings.map((cell, index) => <th scope="col" key={index}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{headings.map((_, column) => <td key={column}>{inline(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const firstItem = listItem(line);
    if (firstItem) {
      const ordered = Boolean(firstItem[1]);
      const items: string[] = [];
      while (position < lines.length) {
        const item = listItem(lines[position]);
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(item[3]); position++;
        while (position < lines.length && /^\s{2,}\S/.test(lines[position]) && !listItem(lines[position])) items[items.length - 1] += `\n${lines[position++].trim()}`;
      }
      const entries = items.map((item, index) => <li key={index}>{inline(item)}</li>);
      blocks.push(ordered ? <ol key={key} start={Number(firstItem[1])}>{entries}</ol> : <ul key={key}>{entries}</ul>); continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (position < lines.length && /^\s*>\s?/.test(lines[position])) quote.push(lines[position++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={key}>{inline(quote.join("\n"))}</blockquote>); continue;
    }
    const paragraph: string[] = [line]; position++;
    while (position < lines.length && lines[position].trim() && !listItem(lines[position]) && !/^\s*(#{1,6}\s|```|>)/.test(lines[position]) && !(position + 1 < lines.length && isTableSeparator(lines[position + 1]))) paragraph.push(lines[position++]);
    blocks.push(<p key={key}>{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="langgraph-response">{blocks}</div>;
}
