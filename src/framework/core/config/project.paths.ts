import path from 'node:path';

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
