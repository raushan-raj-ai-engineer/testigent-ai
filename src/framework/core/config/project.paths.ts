import path from 'node:path';
import { WorkspaceContext } from './workspace.context';

/** Central paths for the selected project. Callers may pass an explicit project for offline/report tooling. */
export class ProjectPaths {
  private static selected(app?: string): string { return app?.trim() || WorkspaceContext.resolve().application; }
  static project(app?: string): string { return path.resolve('projects', this.selected(app)); }
  static tests(app?: string): string { return path.join(this.project(app), 'tests'); }
  static reports(app?: string): string { return path.resolve('reports', this.selected(app)); }
  static businessReport(app?: string): string { return path.join(this.reports(app), 'business'); }
  static htmlReport(app?: string): string { return path.join(this.reports(app), 'playwright-html'); }
  static results(app?: string): string { return path.resolve('test-results', this.selected(app)); }
  static requirements(app?: string): string { return path.join(this.project(app), 'requirements'); }
  static data(app?: string): string { return path.join(this.project(app), 'data'); }
}
