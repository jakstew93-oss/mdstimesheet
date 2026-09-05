import fs from 'node:fs';

const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass at least one bundled HTML file');

const oldBlock = `    if (isAndroid) {
      subEl.textContent = nativeShareAvailable ? 'Ready to share' : 'Ready to download';
      frameShell.classList.add('pdf-no-frame');
      fallbackCopy.textContent = nativeShareAvailable
        ? 'Android often blocks PDF blob previews inside web apps. The PDF has still been created; tap Share PDF to send it.'
        : 'Android often blocks PDF previews inside web apps. The PDF has still been created; tap Download PDF and attach it from Downloads.';
    } else {
      renderPdfPreview();
    }`;

const newBlock = `    // PDF.js renders the PDF to canvas, avoiding Android's blocked blob iframe.
    // Its existing catch handler still provides the download/share fallback.
    renderPdfPreview();`;

for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  const templatePattern = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;
  const match = source.match(templatePattern);
  if (!match) throw new Error(`${path}: bundled template not found`);
  let innerHtml = JSON.parse(match[2].trim());

  const occurrences = innerHtml.split(oldBlock).length - 1;
  if (occurrences !== 1) throw new Error(`${path}: expected one Android preview block, found ${occurrences}`);
  innerHtml = innerHtml.replace(oldBlock, newBlock);

  if (!innerHtml.includes('const renderPdfPreview = async () =>')) throw new Error(`${path}: PDF.js renderer is missing`);
  if (innerHtml.includes('if (isAndroid) {')) throw new Error(`${path}: Android preview bypass remains`);

  const serialized = JSON.stringify(innerHtml).replaceAll('</script>', '<\\/script>');
  const updated = source.replace(templatePattern, `$1${serialized}$3`);
  const resourceManifest = updated.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
  const updatedTemplate = updated.match(templatePattern);
  JSON.parse(resourceManifest[1]);
  JSON.parse(updatedTemplate[2].trim());
  fs.writeFileSync(path, updated);
  console.log(`${path}: Android PDF.js preview enabled and bundle validated`);
}
