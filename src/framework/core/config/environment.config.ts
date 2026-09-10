import type { EnvironmentConfig } from './config.types';
import { ApplicationRegistry } from './application.registry';

/** Framework-facing compatibility view assembled from project-owned configs. */
export class EnvironmentConfigManager {
  private static cached?: EnvironmentConfig;

  static load(): EnvironmentConfig {
    if (this.cached) return this.cached;
    const environment = process.env.ENV ?? 'qa';
    const applications: EnvironmentConfig['applications'] = {};
    for (const project of ApplicationRegistry.listProjects()) {
      try { applications[project] = ApplicationRegistry.get(project, environment); } catch { /* project may not support this env */ }
    }
    this.cached = { environment, applications };
    return this.cached;
  }

  static resetForTest(): void { this.cached = undefined; }
}
