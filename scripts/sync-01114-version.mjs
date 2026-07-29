import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const from=['0.11','13'].join('.');
const to=['0.11','14'].join('.');
const output=execFileSync('git',[
  'grep','-Il',from,'--',
  ':(exclude)node_modules',
  ':(exclude).github/workflows/**'
],{encoding:'utf8'}).trim();
const files=output?output.split('\n').filter(Boolean):[];
let changed=0;
for(const file of files){
  const before=fs.readFileSync(file,'utf8');
  const after=before.split(from).join(to);
  if(after===before) continue;
  fs.writeFileSync(file,after);
  changed+=1;
}
console.log(`Synchronized ${changed} files from ${from} to ${to}.`);
