import {constants,openSync,closeSync,fstatSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {scriptSchema,type VideoScript} from './domain.js';

// Read only the factory's canonical finalized script, never a database-supplied path.
export function readRenderedScript(root:string,job:{id:string;projectId:string}):VideoScript|null{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.id))return null;
 let fd:number|undefined;
 try{
  const directory=path.join(root,job.id),filename=path.join(directory,'script.json');if(realpathSync(root)!==root||realpathSync(directory)!==directory||realpathSync(filename)!==filename)return null;
  fd=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size>256*1024)return null;
  const parsed=scriptSchema.safeParse(JSON.parse(readFileSync(fd,'utf8')));return parsed.success&&parsed.data.projectId===job.projectId?parsed.data:null;
 }catch{return null;}finally{if(fd!==undefined)closeSync(fd);}
}
