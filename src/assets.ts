import {z} from 'zod';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const probe=promisify(execFile);
import {readFile,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import type {ProjectProfile} from './domain.js';
import path from 'node:path';
import {CONFIG_DIR,ROOT_DIR} from './config.js';
export const assetSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/),projectId:z.string(),path:z.string(),kind:z.enum(['gameplay','screenshot']),approved:z.literal(true),source:z.string().min(1),license:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),synthetic:z.boolean().optional()}).strict();
export async function approvedAssets(projectId:string){const assets=z.array(assetSchema).parse(JSON.parse(await readFile(path.join(CONFIG_DIR,'assets.json'),'utf8')));if(new Set(assets.map((a)=>a.id)).size!==assets.length)throw new Error('Approved asset identifiers must be unique');const selected=assets.filter((a)=>a.projectId===projectId);if(projectId==='find-my-needs'&&selected.some((a)=>a.synthetic!==true))throw new Error('Healthcare assets must explicitly be synthetic');return selected;}

export async function availableApprovedAssets(profile:ProjectProfile){const manifest=await approvedAssets(profile.id),available:typeof manifest=[];if(!manifest.length)return available;const roots=await Promise.all(profile.assetDirectories.map(root=>realpath(path.resolve(ROOT_DIR,root))));for(const asset of manifest){try{const original=path.resolve(ROOT_DIR,asset.path),filename=await realpath(original),stat=await lstat(original);if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1||filename!==original||!roots.some(root=>filename.startsWith(root+path.sep)))continue;const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);if(hash.digest('hex')!==asset.sha256)continue;if(asset.kind==='gameplay'){const {stdout}=await probe('ffprobe',['-v','error','-show_streams','-show_format','-of','json',filename],{timeout:5000,maxBuffer:256*1024});const media=JSON.parse(stdout);if(!media.streams?.some((s:any)=>s.codec_type==='video'&&Number(s.duration??media.format?.duration)>0&&Number(s.nb_frames??2)>1))continue;}available.push(asset);}catch{/* Missing or changed bytes stay unavailable. */}}return available;}
