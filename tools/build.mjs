import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import '../extension/vault.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const vault=JSON.parse(await readFile(root+'extension/private-key.vault.json','utf8').catch(()=>{throw new Error('First run prepare-extension.ps1 to encrypt your API key');}));
GrVault.validate(vault);
const manifest=JSON.parse(await readFile(root+'extension/manifest.json','utf8'));
// Minimal dependency-free ZIP writer. Archive contains only extension files.
function crc32(bytes){let crc=0xffffffff;for(const value of bytes){crc^=value;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
const entries=(await readdir(root+'extension',{withFileTypes:true})).filter(x=>x.isFile()).sort((a,b)=>a.name.localeCompare(b.name));
for(const entry of entries){
  const name=Buffer.from(entry.name),data=await readFile(root+'extension/'+entry.name),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
  local.push(h,name,data);central.push(c,name);offset+=h.length+name.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await mkdir(root+'dist/',{recursive:true});const name='gr-vasya-'+manifest.version+'.zip';
await writeFile(root+'dist/'+name,Buffer.concat([...local,directory,end]));
console.log('Ready: dist/'+name);
