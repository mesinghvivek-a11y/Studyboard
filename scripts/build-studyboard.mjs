import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'dist');
const target=process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV, mode=process.argv[2];
if(mode && !['--preview','--production'].includes(mode)) throw Error('Choose --preview or --production.');
if(!mode && process.env.VERCEL && !target) throw Error('Enable Vercel system environment variables for this build.');
const preview=mode ? mode==='--preview' : target!=='production';
const read=name=>fs.readFile(path.join(root,name),'utf8');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex').slice(0,16);
await fs.rm(out,{recursive:true,force:true}); await fs.mkdir(path.join(out,'assets'),{recursive:true});
async function asset(name,ext,content){
  const file='./assets/'+name+'.'+hash(content)+'.'+ext;
  await fs.writeFile(path.join(out,file),content);return file;
}
let html=await read('index.html');
const style=html.match(/<style>([\s\S]*?)<\/style>/),module=html.match(/<script type="module">([\s\S]*?)<\/script>/);
if(!style || !module) throw Error('Cannot locate source CSS and application JS.');
let js=module[1],restore=await read('restore.html');
const shell=['./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png'];
if(preview){
  html=html.replace('<html lang="en">','<html lang="en" data-demo>');
  const demo=await asset('demo','mjs',await read('scripts/studyboard-demo.mjs'));shell.push(demo);
  js=js.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-[\w-]+\.js/g,'./'+path.basename(demo))
    .replace(/const firebaseConfig = \{[\s\S]*?\n\};/,'const firebaseConfig = {};');
  restore='<!doctype html><html lang="en"><meta charset="utf-8"><title>Study Board preview</title><p>Account backups are available on the live site.</p><a href="./">Return to the demo</a></html>';
  if(/study-board-6c9d0|gstatic\.com\/firebasejs/.test(js+restore))throw Error('A production Firebase reference remains in the preview.');
}else{
  if(!js.includes('study-board-6c9d0') || !restore.includes('study-board-6c9d0'))throw Error('Review the changed production Firebase settings.');
  await fs.copyFile(path.join(root,'firebase-client.js'),path.join(out,'firebase-client.js'));
  const preload=[...js.matchAll(/from "(https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+)"/g)].map(m=>`<link rel="modulepreload" href="${m[1]}" crossorigin>`).join('\n');
  html=html.replace('</head>',()=>preload+'\n</head>');
}
const css=await asset('studyboard','css',style[1].trim()),app=await asset('studyboard','mjs',js.trim());
shell.push(css,app);
html=html.replace(style[0],()=>`<link rel="stylesheet" href="${css}">`).replace(module[0],()=>`<script type="module" src="${app}"></script>`).replace('</head>',()=>`<link rel="modulepreload" href="${app}">\n</head>`);
await fs.writeFile(path.join(out,'index.html'),html);await fs.writeFile(path.join(out,'restore.html'),restore);
for(const file of ['.well-known','manifest.json','icons'])await fs.cp(path.join(root,file),path.join(out,file),{recursive:true});
let sw=await read('sw.js');
const release=crypto.createHash('sha256').update(sw);
for(const file of shell)release.update(await fs.readFile(path.join(out,file)));
sw=sw.replace("const RELEASE = '';",`const RELEASE = '${release.digest('hex').slice(0,16)}';`)
  .replace(/const SHELL = \[[^\n]*\];/,'const SHELL = '+JSON.stringify(shell)+';');
await fs.writeFile(path.join(out,'sw.js'),sw);
console.log('Built '+(preview?'offline sample-data preview':'production application')+', HTML '+Buffer.byteLength(html)+' bytes.');
