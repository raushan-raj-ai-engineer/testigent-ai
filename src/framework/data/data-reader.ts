/**
 * Reusable test-data reader contract.
 * Async reading is the default runtime API; sync reading exists for Playwright declaration-time parameterization.
 */
export interface DataReader {
  read<T>(filePath: string): Promise<T>;
  readSync<T>(filePath: string): T;
}
