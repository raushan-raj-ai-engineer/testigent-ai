import path from 'node:path';
import { JsonReader } from './readers/json.reader';
import { CsvReader } from './readers/csv.reader';
import { ExcelReader } from './readers/excel.reader';
import { YamlReader } from './readers/yaml.reader';
import type { DataReader } from './data-reader';

/**
 * Author: Raushan Raj
 * Business Use: One test-data API regardless of JSON/CSV/Excel/YAML source.
 * How to use: await data.load<MyType>('projects/<project>/data/json/users.json').
 * Benefit: Business tests are decoupled from data-file format and reader implementation.
 */
export class DataFactory {
  async load<T>(filePath: string): Promise<T> {
    const extension = path.extname(filePath).toLowerCase();
    const reader = this.readerFor(extension);
    return reader.read<T>(path.resolve(filePath));
  }

  private readerFor(extension: string): DataReader {
    switch (extension) {
      case '.json': return new JsonReader();
      case '.csv': return new CsvReader();
      case '.xlsx': case '.xls': return new ExcelReader();
      case '.yaml': case '.yml': return new YamlReader();
      default: throw new Error(`Unsupported test-data extension: ${extension}`);
    }
  }
}
