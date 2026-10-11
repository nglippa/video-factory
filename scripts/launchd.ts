import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ROOT_DIR} from '../src/config.js';
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const logs=path.join(ROOT_DIR,'data/logs');await mkdir(logs,{recursive:true});
const node=process.execPath;
const write=async(name:string,args:string[],schedule:string)=>{
  const filename=path.join(ROOT_DIR,'config',name+'.plist');
  const body='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>'+name+'</string><key>ProgramArguments</key><array>'+args.map((a)=>'<string>'+xml(a)+'</string>').join('')+'</array><key>WorkingDirectory</key><string>'+xml(ROOT_DIR)+'</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string><key>NODE_ENV</key><string>production</string></dict>'+schedule+'<key>StandardOutPath</key><string>'+xml(path.join(logs,name+'.out.log'))+'</string><key>StandardErrorPath</key><string>'+xml(path.join(logs,name+'.err.log'))+'</string><key>ProcessType</key><string>Background</string><key>Umask</key><integer>63</integer></dict></plist>\n';
  await writeFile(filename,body);console.log(filename);
};
await write('local.video-factory',[node,'--import','tsx','src/server.ts'],'<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>');
await write('local.video-factory.scheduler',[node,'--import','tsx','src/cli.ts','schedule','--file','config/schedules.json'],'<key>StartInterval</key><integer>60</integer>');
console.log('Plists prepared only. Install in '+path.join(os.homedir(),'Library/LaunchAgents')+' using README commands. Schedules remain disabled until configured.');
