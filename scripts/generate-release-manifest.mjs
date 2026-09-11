import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(); const output=path.join(root,'release','RELEASE-MANIFEST.sha256');
const ignoredDirs=new Set(['node_modules','.git','reports','test-results','playwright-report','blob-report','.runtime','.auth','.healing','.report-history','coverage','dist']);
function walk(d){let out=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory()&&ignoredDirs.has(e.name))continue; const p=path.join(d,e.name); if(e.isDirectory())out=out.concat(walk(p)); else out.push(p)} return out}
const files=walk(root).filter(f=>f!==output && path.basename(f)!=='.DS_Store').sort();
const lines=files.map(f=>`${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}  ${path.relative(root,f).replace(/\\/g,'/')}`);
fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,lines.join('\n')+'\n');
console.log(`Wrote ${path.relative(root,output)} for ${lines.length} files.`);
