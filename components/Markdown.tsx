import type { ReactNode } from "react";

// A small Markdown renderer for the legal texts: headings, paragraphs, lists, **bold** and
// [links](https://…). It builds React elements (never raw HTML), and links may only be http(s),
// mailto: or a path on this site.

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${key}-${m.index}`}>{m[1]}</strong>);
    else if (SAFE_HREF.test(m[3])) {
      out.push(
        <a key={`${key}-${m.index}`} href={m[3]} className="font-bold underline" rel="noopener noreferrer">
          {m[2]}
        </a>,
      );
    } else out.push(m[2]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, headingLevelOffset = 0 }: { source: string; headingLevelOffset?: number }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`} className="mt-4">{inline(para.join(" "), `p${blocks.length}`)}</p>);
    if (list.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="mt-4 list-disc space-y-2 ps-6">
          {list.map((item, i) => <li key={i}>{inline(item, `l${blocks.length}-${i}`)}</li>)}
        </ul>,
      );
    }
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      const level = Math.min(6, heading[1].length + headingLevelOffset);
      const Tag = `h${level}` as "h1";
      blocks.push(
        <Tag key={`h${blocks.length}`} className={level <= 1 ? "text-4xl font-extrabold" : "mt-8 text-2xl font-extrabold"}>
          {inline(heading[2], `h${blocks.length}`)}
        </Tag>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      if (para.length) flush();
      list.push(line.replace(/^[-*]\s+/, ""));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return <>{blocks}</>;
}
