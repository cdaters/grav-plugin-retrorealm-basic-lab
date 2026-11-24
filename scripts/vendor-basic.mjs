// Explicit maintainer operation: read a local release, never a network URL.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const file=process.argv[2];if(!file||/^https?:/.test(file))throw Error('Usage: node scripts/vendor-basic.mjs /local/basic/dist/manifest.json [--update]');
const manifestBytes=await fs.readFile(file),manifest=JSON.parse(manifestBytes),sha=b=>createHash('sha256').update(b).digest('hex');
if(manifest.version!=='0.7.0'||!Array.isArray(manifest.packages?.computer)||! /^[0-9a-f]{40}$/.test(manifest.sourceCommit))throw Error('Expected a committed BASIC 0.7.0 release');
try{await fs.access('basic-runtime.lock.json');if(!process.argv.includes('--update'))throw Error('Existing pin: explicit --update required');}catch(e){if(e.code!=='ENOENT')throw e;}
const files=manifest.packages.computer,root=path.resolve(path.dirname(file),'computer'),seen=new Set(),validated=[];
for(const f of files){if(typeof f.path!=='string'||path.isAbsolute(f.path)||f.path.split('/').some(p=>p==='..'||!p)||seen.has(f.path))throw Error('Unsafe or duplicate release path');seen.add(f.path);const source=path.join(root,f.path);if((await fs.lstat(source)).isSymbolicLink())throw Error('Symlink');const bytes=await fs.readFile(source);if(bytes.length!==f.bytes||sha(bytes)!==f.sha256)throw Error('Release file mismatch '+f.path);validated.push([f.path,bytes]);}
const dest='vendor/retrorealm-basic/computer';await fs.rm(dest,{recursive:true,force:true});
for(const [name,bytes]of validated){const target=dest+'/'+name;await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
await fs.writeFile('basic-runtime.lock.json',JSON.stringify({package:'retrorealm-basic',version:manifest.version,build:manifest.build,sourceCommit:manifest.sourceCommit,licenseApplied:manifest.licenseApplied,upstreamManifestSha256:sha(manifestBytes),files},null,2)+'\n');
await fs.writeFile('vendor/retrorealm-basic/manifest.json',manifestBytes);console.log('Vendored BASIC '+manifest.version+' from '+manifest.sourceCommit+'; '+files.length+' verified files');
