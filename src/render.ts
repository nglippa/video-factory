import {bundle} from '@remotion/bundler';
import {makeCancelSignal, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, realpath, rm, stat, statfs, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {approvedAssets} from './assets.js';
import {ROOT_DIR} from './config.js';
import {validateTrustedScript,stableHash,type ProjectProfile,type VideoScript} from './domain.js';

const browserExecutable=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
type Input={jobId:string;script:VideoScript;profile:ProjectProfile;artifactDir:string;signal:AbortSignal;onProgress:(value:{progress:number;stage?:string})=>void};
export type QA={passed:boolean;checks:Array<{name:string;passed:boolean;detail:string}>;probe:unknown};
export async function command(executable:string,args:string[],signal?:AbortSignal):Promise<string>{
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{shell:false,signal,stdio:['ignore','pipe','pipe']});
    let out='',err='';child.stdout.on('data',(b)=>{out+=b.toString();if(out.length>8_000_000)child.kill();});
    child.stderr.on('data',(b)=>{err=(err+b.toString()).slice(-16_000);});
    child.on('error',reject);child.on('close',(code)=>code===0?resolve(out):reject(new Error(executable+' exited '+code+': '+err)));
  });
}
async function hashFile(filename:string){return createHash('sha256').update(await readFile(filename)).digest('hex');}
function contained(parent:string,child:string){const relative=path.relative(parent,child);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
async function resolveAssets(input:Input){
  const manifest=await approvedAssets(input.profile.id);
  const approvedRoots=await Promise.all(input.profile.assetDirectories.map((d)=>realpath(path.resolve(ROOT_DIR,d))));
  const assets:Record<string,string>={};const provenance:unknown[]=[];
  const snapshotDir=path.join(input.artifactDir,'render-public');
  await mkdir(snapshotDir,{recursive:true});
  // Snapshot only the fonts and approved assets used by this job. No remote fetches.
  for(const name of ['newsreader.woff2','newsreader-italic.woff2','instrument.woff2','plex-mono.woff2']){
    const source=path.join(ROOT_DIR,'public','fonts',name);await mkdir(path.join(snapshotDir,'fonts'),{recursive:true});
    await copyFile(source,path.join(snapshotDir,'fonts',name));
    provenance.push({kind:'font',path:'fonts/'+name,source:'Existing Whodunnit locally cached Google Fonts; SIL OFL notices in public/fonts',sha256:await hashFile(source)});
  }
  let logo:string|undefined;
  if(input.profile.logo.type==='image'){
    const source=await realpath(path.join(ROOT_DIR,'public',input.profile.logo.value));
    if(!approvedRoots.some((d)=>contained(d,source)))throw new Error('Logo is outside approved project asset directories');
    const name='logo'+path.extname(source).toLowerCase();
    if(!['.png','.jpg','.jpeg','.svg'].includes(path.extname(name)))throw new Error('Unsupported logo file');
    await copyFile(source,path.join(snapshotDir,name));logo=name;
    provenance.push({kind:'logo',source:input.profile.brandSources,path:input.profile.logo.value,sha256:await hashFile(source)});
  }
  for(const scene of input.script.scenes){
    if(!scene.assetId)continue;
    const asset=manifest.find((a)=>a.id===scene.assetId&&a.projectId===input.profile.id);
    if(!asset)throw new Error('Unapproved visual asset: '+scene.assetId);
    const source=await realpath(path.resolve(ROOT_DIR,asset.path));
    if(!approvedRoots.some((d)=>contained(d,source)))throw new Error('Asset is outside approved project directories');
    if(await hashFile(source)!==asset.sha256)throw new Error('Approved asset checksum changed: '+asset.id);
    const extension=path.extname(source).toLowerCase();
    if(asset.kind==='gameplay'&&!['.mp4','.mov','.webm'].includes(extension))throw new Error('Gameplay requires real approved video');
    if(asset.kind==='screenshot'&&!['.png','.jpg','.jpeg'].includes(extension))throw new Error('Feature demonstration requires approved screenshot');
    if(input.script.template==='gameplay'&&asset.kind!=='gameplay')throw new Error('Gameplay assets must be actual footage');
    if(input.script.template==='feature-demo'&&asset.kind!=='screenshot')throw new Error('Feature assets must be actual screenshots');
    if(asset.kind==='gameplay'){
      const probe=JSON.parse(await command('ffprobe',['-v','error','-show_format','-show_streams','-of','json',source],input.signal));
      if(!Number.isFinite(Number(probe.format?.duration))||Number(probe.format?.duration)<scene.seconds)throw new Error('Footage is shorter than its approved scene');
    }
    const name=asset.id+extension;await copyFile(source,path.join(snapshotDir,name));assets[asset.id]=name;provenance.push(asset);
  }
  if(['gameplay','feature-demo'].includes(input.script.template)&&input.script.scenes.slice(1,3).some((s)=>!s.assetId))throw new Error('This template requires approved visual assets for both middle scenes');
  return {assets,logo,provenance,snapshotDir};
}
export async function validateVideo(filename:string,duration:number,signal?:AbortSignal):Promise<QA>{
  const raw=await command('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',filename],signal);
  const probe=JSON.parse(raw);const video=probe.streams?.find((s:{codec_type:string})=>s.codec_type==='video');const audio=probe.streams?.find((s:{codec_type:string})=>s.codec_type==='audio');
  const checks:QA['checks']=[];
  function check(name:string,passed:boolean,detail:string){checks.push({name,passed,detail});}
  check('Vertical dimensions',video?.width===1080&&video?.height===1920,String(video?.width)+' × '+String(video?.height));
  check('H.264 video',video?.codec_name==='h264',String(video?.codec_name));
  check('Compatible pixel format',video?.pix_fmt==='yuv420p',String(video?.pix_fmt));
  const rate=String(video?.avg_frame_rate).split('/').map(Number);const fps=(rate[0]??0)/(rate[1]??1);
  check('30 fps',Math.abs(fps-30)<0.001,String(fps));
  check('Complete duration',Math.abs(Number(probe.format?.duration)-duration)<0.12,probe.format?.duration+' seconds; expected '+duration);
  check('All frames present',Number(video?.nb_read_frames)===duration*30,video?.nb_read_frames+' decoded frames');
  check('Stereo AAC sound',audio?.codec_name==='aac'&&audio?.channels===2&&Number(audio?.sample_rate)===48000,'AAC / '+audio?.sample_rate+' Hz / '+audio?.channels+' channels');
  check('Nonempty artifact',(await stat(filename)).size>100_000,String((await stat(filename)).size)+' bytes');
  await command('ffmpeg',['-v','error','-xerror','-i',filename,'-f','null','-'],signal);
  check('Full decode',true,'FFmpeg decoded every frame and audio sample without an error');
  return {passed:checks.every((c)=>c.passed),checks,probe};
}
export async function renderVideo(input:Input){
  input.signal.throwIfAborted();validateTrustedScript(input.script,input.profile);
  const disk=await statfs(input.artifactDir);
  if(Number(disk.bavail)*Number(disk.bsize)<2_000_000_000)throw new Error('Rendering needs at least 2 GB free disk space');
  if(!Number.isInteger(Number(process.env.RENDER_CONCURRENCY??2))||Number(process.env.RENDER_CONCURRENCY??2)<1||Number(process.env.RENDER_CONCURRENCY??2)>2)throw new Error('24 GB resource policy limits render concurrency to 1 or 2');
  await stat(browserExecutable);
  const media=await resolveAssets(input);
  const duration=input.script.scenes.reduce((sum,s)=>sum+s.seconds,0);
  const inputProps={script:input.script,profile:input.profile,assets:media.assets,logo:media.logo??null};
  input.onProgress({stage:'bundle',progress:0});
  const bundleDir=path.join(input.artifactDir,'bundle');
  const serveUrl=await bundle({entryPoint:path.join(ROOT_DIR,'src/video/index.tsx'),outDir:bundleDir,publicDir:media.snapshotDir,onProgress:(p)=>input.onProgress({stage:'bundle',progress:p/100})});
  input.signal.throwIfAborted();
  const id={'before-after':'BeforeAfter',explainer:'Explainer','feature-demo':'FeatureDemo',gameplay:'Gameplay',announcement:'Announcement'}[input.script.template];
  const composition=await selectComposition({serveUrl,id,inputProps,browserExecutable});
  input.signal.throwIfAborted();
  const {cancel,cancelSignal}=makeCancelSignal();
  const onAbort=()=>cancel();input.signal.addEventListener('abort',onAbort,{once:true});if(input.signal.aborted)cancel();
  const silentPath=path.join(input.artifactDir,'picture.partial.mp4');
  const videoPath=path.join(input.artifactDir,'video.mp4');const posterPath=path.join(input.artifactDir,'poster.jpg');
  try{
    input.signal.throwIfAborted();
    await renderMedia({serveUrl,composition,inputProps,browserExecutable,outputLocation:silentPath,codec:'h264',pixelFormat:'yuv420p',crf:18,muted:true,concurrency:Number(process.env.RENDER_CONCURRENCY??2),cancelSignal,onProgress:(p)=>input.onProgress({stage:'render',progress:p.progress})});
    input.signal.throwIfAborted();
    await renderStill({serveUrl,composition,inputProps,browserExecutable,cancelSignal,output:posterPath,imageFormat:'jpeg',frame:Math.min(composition.durationInFrames-1,(input.script.scenes[0]!.seconds+input.script.scenes[1]!.seconds+2)*30)});
    input.onProgress({stage:'sound',progress:0});
    // Original synthesized tones. No downloaded music and no randomness.
    const boundaries=input.script.scenes.reduce<number[]>((a,s)=>[...a,(a.at(-1)??0)+s.seconds],[0]).slice(1,-1);
    const chimes=boundaries.map((at)=>'+if(between(t,'+at+','+(at+0.75)+'),0.06*sin(2*PI*880*(t-'+at+'))*exp(-8*(t-'+at+')),0)').join('');
    const music='0.025*sin(2*PI*110*t)+0.025*sin(2*PI*220*t)+0.017*sin(2*PI*329.6276*t)+0.012*sin(2*PI*440*t)'+chimes;
    await command('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',silentPath,'-f','lavfi','-i',"aevalsrc=\'"+music+"\':s=48000:d="+duration,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-vf','scale=in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-af','afade=t=in:d=1,afade=t=out:st='+(duration-1)+':d=1','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',String(duration),'-movflags','+faststart',videoPath],input.signal);
    input.onProgress({stage:'validate',progress:0});
    const qa=await validateVideo(videoPath,duration,input.signal);
    await writeFile(path.join(input.artifactDir,'qa.json'),JSON.stringify(qa,null,2)+'\n');
    const versions=JSON.parse(await readFile(path.join(ROOT_DIR,'package.json'),'utf8'));
    const renderMetadata={template:input.script.template,composition:id,durationSeconds:duration,width:1080,height:1920,fps:30,codec:'h264',crf:18,pixelFormat:'yuv420p',concurrency:Number(process.env.RENDER_CONCURRENCY??2),node:process.version,remotion:versions.dependencies.remotion,ffmpeg:(await command('ffmpeg',['-version'],input.signal)).split('\n')[0],browser:await command(browserExecutable,['--version'],input.signal),videoSha256:await hashFile(videoPath),scriptHash:stableHash(input.script),profileHash:stableHash(input.profile),compositionSha256:await hashFile(path.join(ROOT_DIR,'src/video/index.tsx')),rendererSha256:await hashFile(path.join(ROOT_DIR,'src/render.ts')),assets:media.provenance,audio:{source:'Original deterministic FFmpeg synthesized score',sampleRate:48000,channels:2},qaScope:'Technical checks. Visual, editorial, and brand acceptance require operator review.',renderedAt:new Date().toISOString()};
    input.onProgress({stage:'validate',progress:1});
    return {videoPath,posterPath,qa,renderMetadata};
  }finally{input.signal.removeEventListener('abort',onAbort);await rm(silentPath,{force:true});await rm(bundleDir,{recursive:true,force:true});await rm(media.snapshotDir,{recursive:true,force:true});}
}
