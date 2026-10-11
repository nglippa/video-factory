import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {CONFIG_DIR} from './config.js';
export const assetSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/),projectId:z.string(),path:z.string(),kind:z.enum(['gameplay','screenshot']),approved:z.literal(true),source:z.string().min(1),license:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),synthetic:z.boolean().optional()}).strict();
export async function approvedAssets(projectId:string){const assets=z.array(assetSchema).parse(JSON.parse(await readFile(path.join(CONFIG_DIR,'assets.json'),'utf8')));if(new Set(assets.map((a)=>a.id)).size!==assets.length)throw new Error('Approved asset identifiers must be unique');const selected=assets.filter((a)=>a.projectId===projectId);if(projectId==='find-my-needs'&&selected.some((a)=>a.synthetic!==true))throw new Error('Healthcare assets must explicitly be synthetic');return selected;}
