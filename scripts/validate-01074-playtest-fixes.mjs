import { spawnSync } from 'node:child_process';
const commands=[
  ['npm','run','validate:01074-ios-canvas-text-lifecycle'],
  ['npm','run','validate:01063-safe-restart'],
  ['npm','run','validate:01071-spirit-wolves'],
  ['npm','run','validate:01073-archer-enemy'],
];
for (const [cmd,...args] of commands) {
  const result=spawnSync(cmd,args,{stdio:'inherit'});
  if (result.status!==0) process.exit(result.status ?? 1);
}
console.log('validate-01074-playtest-fixes passed');
