// Dependency-free, explicit public asset export. Never copy the project tree.
import {readFileSync, writeFileSync, mkdirSync, existsSync, cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(root, process.argv[2] || 'dist');
if (existsSync(destination)) throw new Error('Output already exists. Choose a new empty output path; no files were deleted: '+destination);
if (!destination.startsWith(root+path.sep)) throw new Error('Build output must stay within this workspace.');
const html = readFileSync(path.join(root,'index.html'),'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const linked = [...html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|png|svg|webmanifest))"/g)].map(m=>m[1]);
const files = [...new Set(['index.html', ...linked,
  'assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/maskable-512.png',
  'assets/social-demo.svg','vendor/tesseract/tesseract.min.js','vendor/tesseract/worker.min.mjs',
  'vendor/tesseract/core7/tesseract-core-lstm.wasm.mjs','vendor/tesseract/lang/chi_sim.traineddata',
  'vendor/quill/LICENSE','vendor/quill/quill.js.LICENSE.txt',
  'vendor/tesseract/LICENSE.md','vendor/tesseract/tesseract.min.js.LICENSE.txt',
  'vendor/tesseract/worker.min.js.LICENSE.txt','vendor/tesseract/core7/LICENSE','vendor/tesseract/lang/LICENSE'
])].sort();
for (const rel of files) {
  if (rel.startsWith('/') || rel.includes('..') || /[:\\]/.test(rel) || !existsSync(path.join(root,rel))) throw new Error('Invalid public resource: '+rel);
}
const entries = Object.fromEntries(files.map(rel=>[rel,sha(readFileSync(path.join(root,rel)))]));
const template = readFileSync(path.join(root,'scripts/sw-template.js'),'utf8');
const version = '2026.10.27-'+sha(JSON.stringify(entries)+template).slice(0,16);
const worker = template.replace('/* BUILD_ENTRIES */ {}',JSON.stringify(entries,null,2)).replace('BUILD_VERSION',version);
writeFileSync(path.join(root,'sw.js'),worker);
// Fresh unique output avoids deleting or reusing stale/private files from an earlier build.
mkdirSync(destination,{recursive:true});
for (const rel of [...files,'sw.js']) {
  const target=path.join(destination,rel); mkdirSync(path.dirname(target),{recursive:true}); cpSync(path.join(root,rel),target);
}
writeFileSync(path.join(destination,'release.json'),JSON.stringify({version,files:entries,worker:sha(Buffer.from(worker))},null,2)+'\n');
console.log(JSON.stringify({version,directory:destination,files:files.length+2,bytes:files.reduce((n,f)=>n+readFileSync(path.join(root,f)).length,0)}));
