import fs from 'node:fs';

const source = fs.readFileSync('index.html', 'utf8');
const match = source.match(/<script\s+type=["']__bundler\/template["'][^>]*>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Bundled template not found');
const html = JSON.parse(match[1].trim());

const needles = [
  'indexedDB','localStorage','sessionStorage','fetch(','XMLHttpRequest','WebSocket',
  'firebase','supabase','Start Time','Time on Site','Time off Site','End Time',
  'START','ON SITE','OFF SITE','FINISH','timesheet','job number','login','password'
];

console.log(`Extracted template: ${html.length} chars`);
for (const needle of needles) {
  console.log(`\n===== ${needle} =====`);
  let from = 0, shown = 0;
  const lower = html.toLowerCase(), target = needle.toLowerCase();
  while (shown < 8) {
    const at = lower.indexOf(target, from);
    if (at < 0) break;
    const start = Math.max(0, at - 350), end = Math.min(html.length, at + needle.length + 650);
    let snippet = html.slice(start, end)
      .replace(/https?:\/\/[^\s"'<>]+/g, '[URL REDACTED]')
      .replace(/(password|token|secret|apikey|api_key)\s*[:=]\s*["'][^"']+["']/gi, '$1=[REDACTED]');
    console.log(snippet.replace(/\s+/g, ' '));
    from = at + needle.length;
    shown++;
  }
  if (!shown) console.log('(none)');
}
