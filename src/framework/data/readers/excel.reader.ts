import * as XLSX from 'xlsx';
import type { DataReader } from '../data-reader';
/** Author: Raushan Raj | Business Use: Business-owned spreadsheet test datasets. */
export class ExcelReader implements DataReader {
  async read<T>(filePath: string): Promise<T> { return this.readSync<T>(filePath); }
  readSync<T>(filePath: string): T {
    const book = XLSX.readFile(filePath);
    const firstSheetName = book.SheetNames[0];
    if (!firstSheetName) throw new Error(`Excel workbook has no sheets: ${filePath}`);
    const firstSheet = book.Sheets[firstSheetName];
    if (!firstSheet) throw new Error(`Excel first sheet could not be read: ${filePath}`);
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as T;
  }
}
