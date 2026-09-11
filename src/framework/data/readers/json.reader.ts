import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Structured/nested test data and API payloads. */
export class JsonReader implements DataReader {
  async read<T>(filePath: string): Promise<T> { return JSON.parse(await fsp.readFile(filePath, 'utf8')) as T; }
  readSync<T>(filePath: string): T { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T; }
}
