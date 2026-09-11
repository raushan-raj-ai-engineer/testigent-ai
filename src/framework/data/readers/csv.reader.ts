import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Large tabular business datasets/data-driven scenarios. */
export class CsvReader implements DataReader {
  async read<T>(filePath: string): Promise<T> { return this.parse<T>(await fsp.readFile(filePath, 'utf8')); }
  readSync<T>(filePath: string): T { return this.parse<T>(fs.readFileSync(filePath, 'utf8')); }
  private parse<T>(text: string): T { return parse(text, { columns: true, skip_empty_lines: true, trim: true }) as T; }
}
