import fs from 'node:fs';

const paths = process.argv.slice(2);
const names = ['Luke Chambers', 'Mark Smith', 'Jody Wilson'];
if (!paths.length) throw new Error('Pass at least one bundled HTML file');

for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  const templatePattern = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;
  const match = source.match(templatePattern);
  if (!match) throw new Error(`${path}: bundled template not found`);
  let innerHtml = JSON.parse(match[2].trim());

  const fullOptionAnchor = '          <option value="__other__">Other (type below)...</option>';
  const quickOptionAnchor = '              <option value="__other__">Other…</option>';
  if (!innerHtml.includes(fullOptionAnchor) || !innerHtml.includes(quickOptionAnchor)) {
    throw new Error(`${path}: driver dropdown anchors not found`);
  }

  const fullOptions = names.map(name => `          <option value="${name}">${name}</option>`).join('\n');
  const quickOptions = names.map(name => `              <option>${name}</option>`).join('\n');
  innerHtml = innerHtml
    .replace(fullOptionAnchor, `${fullOptions}\n${fullOptionAnchor}`)
    .replace(quickOptionAnchor, `${quickOptions}\n${quickOptionAnchor}`);

  for (const name of names) {
    const count = innerHtml.split(`>${name}</option>`).length - 1;
    if (count !== 2) throw new Error(`${path}: expected ${name} twice, found ${count}`);
  }

  const serialized = JSON.stringify(innerHtml).replaceAll('</script>', '<\\/script>');
  const repaired = source.replace(templatePattern, `$1${serialized}$3`);
  const manifestPayload = repaired.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
  const templatePayload = repaired.match(templatePattern);
  JSON.parse(manifestPayload[1]);
  JSON.parse(templatePayload[2].trim());
  fs.writeFileSync(path, repaired);
  console.log(`${path}: added ${names.join(', ')} and validated`);
}
