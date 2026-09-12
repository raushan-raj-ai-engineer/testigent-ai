import path from 'node:path';
import { RunContext, assertSafeRunId } from './run.context';
import { WorkspaceContext } from './workspace.context';

/** Central artifact paths for the selected project/environment/run. */
export class ProjectPaths {
  private static selected(app?: string): string { return app?.trim() || WorkspaceContext.resolve().application; }
  private static environment(app: string, environment?: string): string {
    return WorkspaceContext.resolveEnvironment(app, environment);
  }
  private static runId(app: string, environment: string, runId?: string): string | undefined {
    const id = runId?.trim() || process.env.RUN_ID?.trim();
    if (id) assertSafeRunId(id);
    return id;
  }

  static latestRunId(app?: string, environment?: string): string | undefined {
    const current = process.env.RUN_ID?.trim();
    if (current) {
      assertSafeRunId(current);
      return current;
    }
    const selected = this.selected(app);
    const env = this.environment(selected, environment);
    return RunContext.latest(selected, env)?.runId;
  }
  static latestReports(app?: string, environment?: string): string {
    const selected = this.selected(app);
    const env = this.environment(selected, environment);
    const id = this.latestRunId(selected, env);
    return this.reports(selected, env, id);
  }
  static latestBusinessReport(app?: string, environment?: string): string {
    return path.join(this.latestReports(app, environment), 'business');
  }
  static latestHtmlReport(app?: string, environment?: string): string {
    return path.join(this.latestReports(app, environment), 'playwright-html');
  }
  static project(app?: string): string { return path.resolve('projects', this.selected(app)); }
  static tests(app?: string): string { return path.join(this.project(app), 'tests'); }
  static applicationReports(app?: string): string { return path.resolve('reports', this.selected(app)); }
  static reports(app?: string, environment?: string, runId?: string): string {
    const selected = this.selected(app);
    const env = this.environment(selected, environment);
    const id = this.runId(selected, env, runId);
    return id ? path.resolve('reports', selected, env, id) : path.resolve('reports', selected, env);
  }
  static businessReport(app?: string, environment?: string, runId?: string): string { return path.join(this.reports(app, environment, runId), 'business'); }
  static htmlReport(app?: string, environment?: string, runId?: string): string { return path.join(this.reports(app, environment, runId), 'playwright-html'); }
  static results(app?: string, environment?: string, runId?: string): string {
    const selected = this.selected(app);
    const env = this.environment(selected, environment);
    const id = this.runId(selected, env, runId);
    return id ? path.resolve('test-results', selected, env, id) : path.resolve('test-results', selected, env);
  }
  static requirements(app?: string): string { return path.join(this.project(app), 'requirements'); }
  static data(app?: string): string { return path.join(this.project(app), 'data'); }
}
