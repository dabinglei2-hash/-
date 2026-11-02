import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const directory=path.resolve(process.argv[2]||'dist');
const release=JSON.parse(readFileSync(path.join(directory,'release.json')));
const expected=[...Object.keys(release.files),'sw.js','release.json'].sort();
function walk(folder,base='') {return readdirSync(folder).flatMap(name=>{
  const file=path.join(folder,name), rel=base+name, stat=lstatSync(file);
  assert(!stat.isSymbolicLink(),'No symlinks in deploy artifact: '+rel);
  return stat.isDirectory()?walk(file,rel+'/'):[rel];
});}
assert.deepEqual(walk(directory).sort(),expected,'Only release allowlist may be published');
for(const [rel,digest]of Object.entries({...release.files,'sw.js':release.worker})){
  const bytes=readFileSync(path.join(directory,rel));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,rel+' digest');
  if(/\.(?:html|js|css|webmanifest|svg|json)$/.test(rel)){
    assert(!/(?:\bntn_|\bsecret_)[A-Za-z0-9_-]{24,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(bytes.toString()),'Credential-like content in '+rel);
  }
}
for(const file of expected)assert(!/^(?:server|backups|work|qa|sources|docs|personal-data|data-backups|\.git|\.env)(?:\/|$)/.test(file));
const manifest=JSON.parse(readFileSync(path.join(directory,'manifest.webmanifest')));
assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./#overview');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const b=readFileSync(path.join(directory,icon.src));assert.equal(b.readUInt32BE(16),+icon.sizes.split('x')[0]);}
console.log(JSON.stringify({version:release.version,publicFiles:expected.length,digests:true,privatePathsExcluded:true,credentialPatternScan:'passed'}));
