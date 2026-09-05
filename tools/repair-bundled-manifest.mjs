import fs from 'node:fs';

const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass at least one bundled HTML file');

for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  const templatePattern = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;
  const match = source.match(templatePattern);
  if (!match) throw new Error(`${path}: bundled template not found`);

  const innerHtml = JSON.parse(match[2].trim());
  const manifestPattern = /<link rel="manifest" href="data:application\/manifest\+json[^>]*>/;
  const matches = innerHtml.match(new RegExp(manifestPattern.source, 'g')) || [];
  if (matches.length !== 1) {
    throw new Error(`${path}: expected exactly one embedded manifest, found ${matches.length}`);
  }

  const repairedInnerHtml = innerHtml.replace(
    manifestPattern,
    '<link rel="manifest" href="manifest.webmanifest">'
  );
  const serializedInnerHtml = JSON.stringify(repairedInnerHtml).replaceAll(
    '</script>',
    '<\\/script>'
  );
  const repairedSource = source.replace(
    templatePattern,
    `$1${serializedInnerHtml}$3`
  );

  const manifestPayload = repairedSource.match(
    /<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/
  );
  const templatePayload = repairedSource.match(templatePattern);
  JSON.parse(manifestPayload[1]);
  const verifiedInnerHtml = JSON.parse(templatePayload[2].trim());
  if (!verifiedInnerHtml.includes('<link rel="manifest" href="manifest.webmanifest">')) {
    throw new Error(`${path}: repaired manifest link was not preserved`);
  }

  fs.writeFileSync(path, repairedSource);
  console.log(`${path}: repaired and validated`);
}
