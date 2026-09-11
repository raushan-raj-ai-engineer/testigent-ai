import fs from 'node:fs';
import path from 'node:path';

export interface WorkspaceSelection {
  application: string;
  environment: string;
  selectedAt?: string;
}

export interface WorkspaceResolveOptions {
  root?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Local developer project selection. The file lives under .runtime and is never committed.
 * Resolution precedence is explicit environment variables -> matching local workspace ->
 * single available environment inference. There is deliberately no demo/qa fallback.
 */
export class WorkspaceContext {
  static file(root = process.cwd()): string {
    return path.resolve(root, '.runtime', 'workspace.json');
  }

  static read(root = process.cwd()): WorkspaceSelection | undefined {
    const file = this.file(root);
    if (!fs.existsSync(file)) return undefined;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<WorkspaceSelection>;
      const application = parsed.application?.trim();
      const environment = parsed.environment?.trim();
      if (!application || !environment) return undefined;
      return { application, environment, selectedAt: parsed.selectedAt };
    } catch {
      return undefined;
    }
  }

  static write(application: string, environment: string, root = process.cwd()): WorkspaceSelection {
    const app = this.requireName('application', application);
    const env = this.requireName('environment', environment);
    const selection: WorkspaceSelection = { application: app, environment: env, selectedAt: new Date().toISOString() };
    const file = this.file(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(selection, null, 2));
    return selection;
  }

  static clear(root = process.cwd()): void {
    fs.rmSync(this.file(root), { force: true });
  }

  static resolve(options: WorkspaceResolveOptions = {}): WorkspaceSelection {
    const root = options.root ?? process.cwd();
    const env = options.env ?? process.env;
    const stored = this.read(root);
    const explicitApplication = env.APP?.trim();
    const application = explicitApplication || stored?.application;

    if (!application) {
      const projects = this.listProjects(root);
      throw new Error(
        `No project selected. Run \"npm run qa:use -- <project> <environment>\" or set APP and ENV. ` +
        `Available projects: ${projects.join(', ') || '(none)'}`,
      );
    }

    const explicitEnvironment = env.ENV?.trim();
    const storedEnvironment = stored?.application === application ? stored.environment : undefined;
    const environment = explicitEnvironment || storedEnvironment || this.inferSingleEnvironment(application, root);

    if (!environment) {
      const environments = this.listEnvironments(application, root);
      throw new Error(
        `No environment selected for project '${application}'. Run \"npm run qa:use -- ${application} <environment>\" ` +
        `or set ENV. Available environments: ${environments.join(', ') || '(none)'}`,
      );
    }

    return { application, environment, selectedAt: stored?.selectedAt };
  }

  static resolveEnvironment(
    application: string,
    environment?: string,
    root = process.cwd(),
    env: NodeJS.ProcessEnv = process.env,
  ): string {
    const explicit = environment?.trim();
    if (explicit) return explicit;
    const fromProcess = env.ENV?.trim();
    if (fromProcess) return fromProcess;
    const stored = this.read(root);
    if (stored?.application === application && stored.environment) return stored.environment;
    const inferred = this.inferSingleEnvironment(application, root);
    if (inferred) return inferred;
    const environments = this.listEnvironments(application, root);
    throw new Error(
      `Environment is required for project '${application}'. Available environments: ${environments.join(', ') || '(none)'}`,
    );
  }

  static listProjects(root = process.cwd()): string[] {
    const projectsRoot = path.resolve(root, 'projects');
    if (!fs.existsSync(projectsRoot)) return [];
    return fs.readdirSync(projectsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && fs.existsSync(path.join(projectsRoot, entry.name, 'config')))
      .map(entry => entry.name)
      .sort();
  }

  static listEnvironments(application: string, root = process.cwd()): string[] {
    const configRoot = path.resolve(root, 'projects', application, 'config');
    if (!fs.existsSync(configRoot)) return [];
    return fs.readdirSync(configRoot, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name.slice(0, -'.json'.length))
      .sort();
  }

  private static inferSingleEnvironment(application: string, root: string): string | undefined {
    const environments = this.listEnvironments(application, root);
    return environments.length === 1 ? environments[0] : undefined;
  }

  private static requireName(label: string, value: string): string {
    const normalized = value.trim();
    if (!normalized || !/^[a-z0-9][a-z0-9._-]*$/i.test(normalized)) {
      throw new Error(`Invalid ${label} '${value}'. Use letters, numbers, dot, underscore or dash.`);
    }
    return normalized;
  }
}
