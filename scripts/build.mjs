import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';import {inventory,verifyVendor} from './inventory.mjs';
const pin=await verifyVendor(),release=JSON.parse(await fs.readFile('release.json'));
let commit='working-tree';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
async function copy(a,b){await fs.mkdir(path.dirname(b),{recursive:true});await fs.copyFile(a,b);}
async function tree(a,b){for(const e of await fs.readdir(a,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlink rejected');if(e.isDirectory())await tree(a+'/'+e.name,b+'/'+e.name);else await copy(a+'/'+e.name,b+'/'+e.name);}}
// Root generated mirror makes a normal GitHub source checkout directly installable.
await fs.rm('assets/environments/basic-session',{recursive:true,force:true});await tree('vendor/retrorealm-basic/computer','assets/environments/basic-session');
const out='dist/plugin';await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const p of ['retrorealm-basic-lab.php','retrorealm-basic-lab.yaml','blueprints.yaml','classes','templates','pages','environments','assets','README.md','CHANGELOG.md','LICENSE','NOTICE','THIRD-PARTY-NOTICES.md','basic-runtime.lock.json','docs','examples']){const stat=await fs.stat(p);if(stat.isDirectory())await tree(p,out+'/'+p);else await copy(p,out+'/'+p);}
await fs.writeFile(out+'/BUILD.json',JSON.stringify({...release,sourceCommit:commit,dependency:{name:pin.package,version:pin.version,sourceCommit:pin.sourceCommit,manifestSha256:pin.upstreamManifestSha256}},null,2)+'\n');
await fs.writeFile('dist/manifest.json',JSON.stringify({...release,sourceCommit:commit,packages:{plugin:await inventory(out)}},null,2)+'\n');console.log('Built BASIC Lab '+release.version+' with pinned offline BASIC '+pin.version);
