/** Exploration authentication/session-state helpers. Author: Raushan Raj */
import { access, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch{return false;}}

export function explorationStorageStatePath(root:string,app:string):string{
  const configured=process.env.EXPLORATION_STORAGE_STATE?.trim();
  if(configured)return isAbsolute(configured)?configured:join(root,configured);
  return join(root,'.auth',`${app}.exploration.json`);
}

/**
 * Reusable framework function `contextOptionsWithAuth`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function contextOptionsWithAuth(root:string,app:string):Promise<{storageState?:string}>{
  const path=explorationStorageStatePath(root,app);
  return (await exists(path))?{storageState:path}:{};
}

/**
 * Reusable framework function `ensureStorageStateDirectory`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function ensureStorageStateDirectory(path:string):Promise<void>{await mkdir(dirname(path),{recursive:true});}
