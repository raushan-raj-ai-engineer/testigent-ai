import fs from 'node:fs/promises';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Structured/nested test data and API payloads. */
export class JsonReader implements DataReader {
  async read<T>(filePath: string): Promise<T> { return JSON.parse(await fs.readFile(filePath, 'utf8')) as T; }
}
