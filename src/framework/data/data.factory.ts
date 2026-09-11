import path from 'node:path';
import { JsonReader } from './readers/json.reader';
import { CsvReader } from './readers/csv.reader';
import { ExcelReader } from './readers/excel.reader';
import { YamlReader } from './readers/yaml.reader';
import type { DataReader } from './data-reader';

/** Minimum contract for independently addressable data-driven test cases. */
export interface DataCase { caseId: string; [key: string]: unknown; }

export interface LoadCasesOptions {
  /** Dot path to an array when the source root is an object, e.g. `login.cases`. */
  collectionPath?: string;
  /** Alternative case-id key for legacy datasets. Defaults to `caseId`. */
  caseIdKey?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: One test-data API regardless of JSON/CSV/Excel/YAML source.
 * How to use: `await data.load<T>(path)` for runtime reads or `data.loadCasesSync(path)` while declaring parameterized tests.
 * Benefit: Business tests are decoupled from file format while duplicate IDs fail before expensive browser execution.
 */
export class DataFactory {
  /** Loads arbitrary structured data asynchronously. */
  async load<T>(filePath: string): Promise<T> {
    const reader = this.readerFor(path.extname(filePath).toLowerCase());
    return reader.read<T>(path.resolve(filePath));
  }

  /** Loads arbitrary data synchronously for Playwright declaration-time parameterization. */
  loadSync<T>(filePath: string): T {
    const reader = this.readerFor(path.extname(filePath).toLowerCase());
    return reader.readSync<T>(path.resolve(filePath));
  }

  /** Loads and validates independently identifiable data cases asynchronously. */
  async loadCases<T extends Record<string, unknown> = DataCase>(filePath: string, options: LoadCasesOptions = {}): Promise<T[]> {
    return this.normalizeCases<T>(await this.load<unknown>(filePath), filePath, options);
  }

  /**
   * Loads and validates data cases synchronously so each row can create its own Playwright test.
   * This avoids the anti-pattern of looping thousands of rows inside one test and preserves sharding/report identity.
   */
  loadCasesSync<T extends Record<string, unknown> = DataCase>(filePath: string, options: LoadCasesOptions = {}): T[] {
    return this.normalizeCases<T>(this.loadSync<unknown>(filePath), filePath, options);
  }

  private normalizeCases<T extends Record<string, unknown>>(raw: unknown, filePath: string, options: LoadCasesOptions): T[] {
    const collection = options.collectionPath ? getByPath(raw, options.collectionPath) : raw;
    if (!Array.isArray(collection)) {
      throw new Error(`Data-driven case source must resolve to an array: ${filePath}${options.collectionPath ? `#${options.collectionPath}` : ''}`);
    }
    const caseIdKey = options.caseIdKey ?? 'caseId';
    const seen = new Set<string>();
    return collection.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Case ${index + 1} in ${filePath} must be an object.`);
      const value = (item as Record<string, unknown>)[caseIdKey];
      const caseId = String(value ?? '').trim();
      if (!caseId) throw new Error(`Case ${index + 1} in ${filePath} is missing non-empty '${caseIdKey}'.`);
      if (seen.has(caseId)) throw new Error(`Duplicate ${caseIdKey} '${caseId}' in ${filePath}. Case IDs must be globally unique within a dataset.`);
      seen.add(caseId);
      return item as T;
    });
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

function getByPath(value: unknown, collectionPath: string): unknown {
  return collectionPath.split('.').filter(Boolean).reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
