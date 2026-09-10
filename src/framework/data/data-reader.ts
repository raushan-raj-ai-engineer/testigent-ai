/** Author: Raushan Raj */
export interface DataReader { read<T>(filePath: string): Promise<T>; }
