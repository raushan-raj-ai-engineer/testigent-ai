import fs from 'node:fs';
import path from 'node:path';

export interface KnownDefect {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED';
  scope?: string;
  note?: string;
}

export interface RuntimeAnnotationSink {
  annotations: Array<{ type: string; description?: string }>;
}

/**
 * Reusable framework class `KnownDefectRegistry`.
 * Business Use: Centralizes approved product-defect metadata and its runtime reporting annotation.
 * Benefit: Expected failures remain explicit, auditable and business-visible instead of being hidden inside Playwright's native passed count.
 */
export class KnownDefectRegistry {
  static get(project: string, id: string): KnownDefect | undefined {
    const file = path.resolve('projects', project, 'known-defects.json');
    if (!fs.existsSync(file)) return undefined;
    const defects = JSON.parse(fs.readFileSync(file, 'utf8')) as KnownDefect[];
    return defects.find(defect => defect.id === id && defect.status === 'OPEN');
  }

  static annotate(testInfo: RuntimeAnnotationSink, defect: KnownDefect): void {
    const description = JSON.stringify({
      id: defect.id,
      title: defect.title,
      scope: defect.scope,
      note: defect.note
    });
    const exists = testInfo.annotations.some(annotation => annotation.type === 'known-defect' && annotation.description === description);
    if (!exists) testInfo.annotations.push({ type: 'known-defect', description });
  }
}
