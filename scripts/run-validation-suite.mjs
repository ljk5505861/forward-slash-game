import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Run every regression, then compare failures with the PR base. Existing failures
// remain visible; a new failure or changed failure output makes CI fail.
const root=process.cwd();
const base=process.env.VALIDATION_BASE_SHA;
const scripts=fs.readdirSync('scripts').filter(name=>/^validate-.*\.mjs$/.test(name)).sort();
const execute=(cwd,file)=>spawnSync(process.execPath,['scripts/'+file],{cwd,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
const failed=[];
for(const file of scripts){
  const result=execute(root,file);
  if(result.status===0) console.log('PASS '+file);
  else {failed.push({file,result});console.log('FAIL '+file+'\n'+result.stdout+result.stderr);}
}
let introduced=0;
if(failed.length && base){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'game-regression-base-'));
  const checkout=spawnSync('git',['worktree','add','--detach',dir,base],{encoding:'utf8'});
  if(checkout.status!==0) throw new Error(checkout.stderr);
  try {
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const normalize=(result,cwd)=>(result.stdout+result.stderr).replaceAll(cwd,'<repo>').replace(/\(node:\d+\)/g,'(node:<pid>)')
      .replace(/0[.\\]+11[.\\]+\d+/g,'<version>').replace(/Node.js v[^\n]+/g,'<node>');
    for(const {file,result} of failed){
      const previous=execute(dir,file);
      if(previous.status!==0 && normalize(result,root)===normalize(previous,dir)){
        console.log('UNCHANGED BASELINE FAILURE '+file);
      } else {introduced++;console.error('NEW/CHANGED FAILURE '+file+'\nBASE OUTPUT:\n'+previous.stdout+previous.stderr);}
    }
  } finally {spawnSync('git',['worktree','remove','--force',dir]);fs.rmSync(dir,{recursive:true,force:true});}
} else introduced=failed.length;
console.log(JSON.stringify({scripts:scripts.length,passed:scripts.length-failed.length,baselineFailures:failed.length-introduced,introduced}));
if(introduced) process.exitCode=1;
