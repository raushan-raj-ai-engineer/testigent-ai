import fs from 'node:fs';
import path from 'node:path';
import type { ApplicationConfig, ProjectEnvironmentConfig, ProjectAuthConfig } from './config.types';
import { WorkspaceContext } from './workspace.context';

/**
 * Multi-project application registry.
 * Project URLs/auth policy live under projects/<project>/config/<env>.json.
 * Reusable framework code never owns application-specific endpoints or hidden project defaults.
 */
export class ApplicationRegistry {
  static get(applicationName: string, environment?: string, root = process.cwd()): ApplicationConfig {
    return this.projectConfig(applicationName, environment, root).application;
  }

  static current(root = process.cwd()): ApplicationConfig {
    const target = WorkspaceContext.resolve({ root });
    return this.get(target.application, target.environment, root);
  }

  static auth(applicationName?: string, environment?: string, root = process.cwd()): ProjectAuthConfig {
    if (!applicationName) {
      const target = WorkspaceContext.resolve({ root });
      return this.projectConfig(target.application, target.environment, root).auth ?? { strategy: 'none' };
    }
    return this.projectConfig(applicationName, environment, root).auth ?? { strategy: 'none' };
  }

  static projectConfig(applicationName: string, environment?: string, root = process.cwd()): ProjectEnvironmentConfig {
    const resolvedEnvironment = WorkspaceContext.resolveEnvironment(applicationName, environment, root);
    const configPath = path.resolve(root, 'projects', applicationName, 'config', `${resolvedEnvironment}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Project configuration not found: ${configPath}. ` +
        `Create projects/${applicationName}/config/${resolvedEnvironment}.json or run npm run project:new -- ${applicationName}.`,
      );
    }
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as ProjectEnvironmentConfig;
    if (!parsed.application?.uiBaseUrl || !parsed.application?.apiBaseUrl) {
      throw new Error(`Invalid project configuration: ${configPath}`);
    }
    if (parsed.environment && parsed.environment !== resolvedEnvironment) {
      throw new Error(`Environment mismatch in ${configPath}: expected '${resolvedEnvironment}', found '${parsed.environment}'.`);
    }
    return parsed;
  }

  static listProjects(root = process.cwd()): string[] {
    return WorkspaceContext.listProjects(root);
  }
}
