import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const css = fs.readFileSync(new URL('./modern-mobile.css', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);
for (const name of ['index.html', 'Index.html']) {
  const file = fileURLToPath(new URL(name, root));
  const source = fs.readFileSync(file, 'utf8');
  const pattern = /(<script\s+type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing bundle template in ${name}`);
  let html = JSON.parse(match[2]);
  html = html.replace(/<style id="mds-modern-mobile">[\s\S]*?<\/style>\s*/g, '');
  if (!html.includes('</body>')) throw new Error('Missing body closing tag');
  html = html.replace('</body>', `<style id="mds-modern-mobile">\n${css}</style>\n</body>`);
  html = html.replace('width=device-width, initial-scale=1.0, maximum-scale=1.0', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  // Escape script end tags in JSON so the outer HTML parser retains the complete bundle.
  const encoded = JSON.stringify(html).replace(/<\/script/gi, '<\\/script');
  const output = source.replace(pattern, (_, open, old, close) => `${open}\n${encoded}\n${close}`);
  JSON.parse(output.match(pattern)[2]);
  fs.writeFileSync(file, output);
}
console.log('Updated both bundled entry points.');
