import path from 'node:path';

/**
 * Reusable framework class `ProjectPaths`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class ProjectPaths {
  static project(app = process.env.APP?.trim() || 'demo'): string { return path.resolve('projects', app); }
  static tests(app = process.env.APP?.trim() || 'demo'): string { return path.join(this.project(app), 'tests'); }
  static reports(app = process.env.APP?.trim() || 'demo'): string { return path.resolve('reports', app); }
  static businessReport(app = process.env.APP?.trim() || 'demo'): string { return path.join(this.reports(app), 'business'); }
  static htmlReport(app = process.env.APP?.trim() || 'demo'): string { return path.join(this.reports(app), 'playwright-html'); }
  static results(app = process.env.APP?.trim() || 'demo'): string { return path.resolve('test-results', app); }
  static requirements(app = process.env.APP?.trim() || 'demo'): string { return path.join(this.project(app), 'requirements'); }
  static data(app = process.env.APP?.trim() || 'demo'): string { return path.join(this.project(app), 'data'); }
}
