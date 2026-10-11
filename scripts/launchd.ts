import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ROOT_DIR} from '../src/config.js';
import {assertLocalBaseUrl} from '../src/models.js';
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const logs=path.join(ROOT_DIR,'data/logs');await mkdir(logs,{recursive:true});
const node=process.execPath;
const write=async(name:string,args:string[],schedule:string,environment:Record<string,string>={})=>{
  const filename=path.join(ROOT_DIR,'config',name+'.plist');
  const body='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>'+name+'</string><key>ProgramArguments</key><array>'+args.map((a)=>'<string>'+xml(a)+'</string>').join('')+'</array><key>WorkingDirectory</key><string>'+xml(ROOT_DIR)+'</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string><key>NODE_ENV</key><string>production</string>'+Object.entries(environment).map(([key,value])=>'<key>'+xml(key)+'</key><string>'+xml(value)+'</string>').join('')+'</dict>'+schedule+'<key>StandardOutPath</key><string>'+xml(path.join(logs,name+'.out.log'))+'</string><key>StandardErrorPath</key><string>'+xml(path.join(logs,name+'.err.log'))+'</string><key>ExitTimeOut</key><integer>30</integer><key>ProcessType</key><string>Background</string><key>Umask</key><integer>63</integer></dict></plist>\n';
  await writeFile(filename,body);console.log(filename);
};
await write('local.video-factory',[node,'--env-file-if-exists=.env','--import','tsx','src/server.ts'],'<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>');
await write('local.video-factory.scheduler',[node,'--env-file-if-exists=.env','--import','tsx','src/cli.ts','schedule','--file','config/schedules.json'],'<key>StartInterval</key><integer>60</integer>');
const ollamaBase=assertLocalBaseUrl(process.env.OLLAMA_BASE_URL??'http://127.0.0.1:11434');
if(ollamaBase.pathname&&ollamaBase.pathname!=='/')throw new Error('Ollama LaunchAgent requires a base URL without a path');
await write('local.video-factory.ollama',[process.env.OLLAMA_BIN??'/opt/homebrew/bin/ollama','serve'],'<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>',{OLLAMA_HOST:ollamaBase.host,OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1'});
console.log('Plists prepared only. Install in '+path.join(os.homedir(),'Library/LaunchAgents')+' using README commands. Schedule enablement and the production window are controlled by config/schedules.json and config/production.json.');
