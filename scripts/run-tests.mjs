// Tests use independent base configuration, never the operator's live approvals.
import {mkdtemp,mkdir,copyFile,readdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temporary=await mkdtemp(path.join(os.tmpdir(),'factory-tests-')),config=path.join(temporary,'config');
try{
 await mkdir(path.join(config,'projects'),{recursive:true});
 for(const file of ['knowledge.json','assets.json','production.json','schedules.json','idea-schedules.json','backlog.json']){try{await copyFile(path.join(root,'config',file),path.join(config,file));}catch(error){if(error.code!=='ENOENT')throw error;}}
 for(const file of (await readdir(path.join(root,'config/projects'))).filter(f=>f.endsWith('.json')))await copyFile(path.join(root,'config/projects',file),path.join(config,'projects',file));
 const tests=(await readdir(path.join(root,'tests'))).filter(f=>f.endsWith('.test.ts')).sort().map(f=>path.join(root,'tests',f));
 const child=spawn(process.execPath,['--import','tsx','--test',...tests],{cwd:root,stdio:'inherit',env:{...process.env,CONFIG_DIR:config,DATA_DIR:path.join(temporary,'data'),DB_PATH:path.join(temporary,'test.sqlite')}});
 process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});
}finally{await rm(temporary,{recursive:true,force:true});}
