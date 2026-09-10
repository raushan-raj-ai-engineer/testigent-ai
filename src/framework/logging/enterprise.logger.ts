import fs from 'node:fs';
import path from 'node:path';
import { redact } from './redactor';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Author: Raushan Raj
 * Business Use: Produces correlation-friendly structured logs across UI/API/DB/AI layers.
 * How to use: logger.info('ORDER_CREATED', { orderId }) inside reusable business services/workflows.
 * Benefit: One run/test identifier connects evidence from different technology layers.
 */
export class EnterpriseLogger {
  constructor(
    private readonly context: Record<string, unknown> = {},
    private readonly filePath = path.resolve('reports/logs/execution.jsonl')
  ) {}

  child(context: Record<string, unknown>): EnterpriseLogger {
    return new EnterpriseLogger({ ...this.context, ...context }, this.filePath);
  }

  info(event: string, data: unknown = {}): void { this.write('INFO', event, data); }
  warn(event: string, data: unknown = {}): void { this.write('WARN', event, data); }
  error(event: string, data: unknown = {}): void { this.write('ERROR', event, data); }
  debug(event: string, data: unknown = {}): void { this.write('DEBUG', event, data); }

  private write(level: LogLevel, event: string, data: unknown): void {
    const entry = redact({ timestamp: new Date().toISOString(), level, event, ...this.context, data });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`);
    if (level === 'ERROR') console.error(JSON.stringify(entry));
  }
}
