import '../extension/vault.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Receives credentials over stdin, never via command-line arguments or env.
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>16000)throw new Error('Input too large');}
let data;try {data=JSON.parse(input.replace(/^\uFEFF/,''));}catch{throw new Error('Use prepare-extension.ps1 to enter credentials locally');}
const vault=await GrVault.seal(data.authKey?.trim(),data.password);
data=null;input='';
await mkdir(root+'extension/',{recursive:true});
await writeFile(root+'extension/private-key.vault.json',JSON.stringify(vault,null,2)+'\n',{mode:0o600});
console.log('Encrypted key saved locally. Plain API key and password were not written to disk.');
