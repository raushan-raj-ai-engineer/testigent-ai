import * as XLSX from 'xlsx';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Business-owned spreadsheet test datasets. */
export class ExcelReader implements DataReader {
  async read<T>(filePath: string): Promise<T> {
    const book = XLSX.readFile(filePath);
    const firstSheet = book.Sheets[book.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as T;
  }
}
