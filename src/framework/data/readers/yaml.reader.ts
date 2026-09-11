import fs from 'node:fs';
import fsp from 'node:fs/promises';
import YAML from 'yaml';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Human-readable configuration/scenario data. */
export class YamlReader implements DataReader {
  async read<T>(filePath: string): Promise<T> { return YAML.parse(await fsp.readFile(filePath, 'utf8')) as T; }
  readSync<T>(filePath: string): T { return YAML.parse(fs.readFileSync(filePath, 'utf8')) as T; }
}
