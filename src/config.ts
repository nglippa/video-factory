import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectProfileSchema, type ProjectProfile} from './domain.js';
import {readSourceApprovals} from './source-recovery.js';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_DIR = path.resolve(process.env.CONFIG_DIR ?? path.join(ROOT_DIR, 'config'));
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(ROOT_DIR, 'data'));
export const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts');
export const DB_PATH = path.resolve(process.env.DB_PATH ?? path.join(DATA_DIR, 'factory.sqlite'));
export const PORT = Number(process.env.PORT ?? 4317);
export const HOST = '127.0.0.1' as const;

export async function loadProfiles(): Promise<ProjectProfile[]> {
  const directory = path.join(CONFIG_DIR, 'projects');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  const profiles = await Promise.all(files.map(async (file) => {
    const parsed = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    return projectProfileSchema.parse(parsed);
  }));
  const ids = new Set<string>();
  for (const profile of profiles) {
    if (ids.has(profile.id)) throw new Error(`Duplicate project profile id: ${profile.id}`);
    ids.add(profile.id);
  }
  for (const approval of await readSourceApprovals(CONFIG_DIR)) {
    const index=profiles.findIndex(p=>p.id===approval.profile.id);
    if(index<0)throw new Error('Approved source references unknown profile');
    profiles[index]={...approval.profile,voice:[...approval.profile.voice,'Source approval note: '+approval.reason],restrictions:[...approval.profile.restrictions,...(approval.profile.id==='terra-steam-tycoon'&&/gameplay/i.test(approval.reason)&&/critical|required|necessary/i.test(approval.reason)?['HUMAN_REQUIRES_GAMEPLAY_FOOTAGE']:[])]};
  }
  return profiles;
}

export async function loadProfile(id: string): Promise<ProjectProfile> {
  const profile = (await loadProfiles()).find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown project: ${id}`);
  if (!profile.enabled) throw new Error(`Project is disabled: ${id}`);
  return profile;
}
