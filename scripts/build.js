import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const jsResult = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
});
const js = jsResult.outputFiles[0].text;

const cssResult = await esbuild.build({
  entryPoints: [path.join(root, 'src/styles.css')],
  bundle: true,
  minify: true,
  write: false,
});
const css = cssResult.outputFiles[0].text;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pomodoro</title>
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>
`;

writeFileSync(path.join(root, 'index.html'), html);
console.log('Built index.html');
