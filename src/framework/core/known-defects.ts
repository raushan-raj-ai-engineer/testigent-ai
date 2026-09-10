import fs from 'node:fs';
import path from 'node:path';

export interface KnownDefect {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED';
  scope?: string;
  note?: string;
}

export class KnownDefectRegistry {
  static get(project: string, id: string): KnownDefect | undefined {
    const file = path.resolve('projects', project, 'known-defects.json');
    if (!fs.existsSync(file)) return undefined;
    const defects = JSON.parse(fs.readFileSync(file, 'utf8')) as KnownDefect[];
    return defects.find(defect => defect.id === id && defect.status === 'OPEN');
  }
}
