import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Large tabular business datasets/data-driven scenarios. */
export class CsvReader implements DataReader {
  async read<T>(filePath: string): Promise<T> {
    const text = await fs.readFile(filePath, 'utf8');
    return parse(text, { columns: true, skip_empty_lines: true, trim: true }) as T;
  }
}
