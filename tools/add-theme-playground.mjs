import { readFileSync, writeFileSync } from 'node:fs';
for (const name of ['index.html', 'Index.html']) {
  let source = readFileSync(name, 'utf8');
  const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
  if (!match) throw new Error('Missing bundle template: ' + name);
  let template = JSON.parse(match[2]);
  if (!template.includes('href="./themes.css"')) template = template.replace('</head>', '<link rel="stylesheet" href="./themes.css">\n</head>');
  if (!template.includes('src="./themes.js"')) template = template.replace('</body>', '<script src="./themes.js"></script>\n</body>');
  const encoded = JSON.stringify(template).replaceAll('</', '<\\/');
  writeFileSync(name, source.slice(0, match.index + match[1].length) + encoded + source.slice(match.index + match[1].length + match[2].length));
}
let sw = readFileSync('sw.js', 'utf8').replace(/const CACHE_NAME = '[^']+';/, "const CACHE_NAME = 'mdsmiths-timesheet-themes-v3';");
if (!sw.includes("'./themes.js'")) sw = sw.replace("  './recent-regs.js',", "  './themes.js',\n  './themes.css',\n  './recent-regs.js',");
writeFileSync('sw.js', sw);
console.log('Theme assets added to both bundle entry points and offline cache.');
