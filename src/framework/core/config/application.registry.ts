import fs from 'node:fs';
import path from 'node:path';
import type { ApplicationConfig, ProjectEnvironmentConfig, ProjectAuthConfig } from './config.types';

/**
 * Multi-project application registry.
 * Project URLs/auth policy live under projects/<project>/config/<env>.json.
 * Reusable framework code never owns application-specific endpoints.
 */
export class ApplicationRegistry {
  static get(applicationName: string, environment = process.env.ENV ?? 'qa'): ApplicationConfig {
    return this.projectConfig(applicationName, environment).application;
  }

  static current(): ApplicationConfig {
    return this.get(process.env.APP ?? 'demo');
  }

  static auth(applicationName = process.env.APP ?? 'demo', environment = process.env.ENV ?? 'qa'): ProjectAuthConfig {
    return this.projectConfig(applicationName, environment).auth ?? { strategy: 'none' };
  }

  static projectConfig(applicationName: string, environment = process.env.ENV ?? 'qa'): ProjectEnvironmentConfig {
    const configPath = path.resolve('projects', applicationName, 'config', `${environment}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Project configuration not found: ${configPath}. ` +
        `Create projects/${applicationName}/config/${environment}.json or run npm run project:new -- ${applicationName}.`,
      );
    }
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as ProjectEnvironmentConfig;
    if (!parsed.application?.uiBaseUrl || !parsed.application?.apiBaseUrl) {
      throw new Error(`Invalid project configuration: ${configPath}`);
    }
    return parsed;
  }

  static listProjects(): string[] {
    const projectsRoot = path.resolve('projects');
    if (!fs.existsSync(projectsRoot)) return [];
    return fs.readdirSync(projectsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && fs.existsSync(path.join(projectsRoot, entry.name, 'config')))
      .map(entry => entry.name)
      .sort();
  }
}
