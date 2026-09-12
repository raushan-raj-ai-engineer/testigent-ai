import type { EnvironmentConfig } from './config.types';
import { ApplicationRegistry } from './application.registry';
import { WorkspaceContext } from './workspace.context';

/** Framework-facing compatibility view assembled from project-owned configs for the selected environment. */
export class EnvironmentConfigManager {
  private static cached?: EnvironmentConfig;
  private static cacheKey?: string;

  static load(root = process.cwd()): EnvironmentConfig {
    const target = WorkspaceContext.resolve({ root });
    const key = `${root}:${target.environment}`;
    if (this.cached && this.cacheKey === key) return this.cached;

    const applications: EnvironmentConfig['applications'] = {};
    for (const project of ApplicationRegistry.listProjects(root)) {
      try { applications[project] = ApplicationRegistry.get(project, target.environment, root); }
      catch { /* a project may intentionally not support the selected environment */ }
    }
    this.cached = { environment: target.environment, applications };
    this.cacheKey = key;
    return this.cached;
  }

  static resetForTest(): void {
    this.cached = undefined;
    this.cacheKey = undefined;
  }
}
