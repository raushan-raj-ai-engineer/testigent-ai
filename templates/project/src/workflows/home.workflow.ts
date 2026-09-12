import type { HomePage } from '../pages/home.page';

/** Minimal starter business workflow. Replace/extend with domain journeys as the project grows. */
export class HomeWorkflow {
  constructor(private readonly page: HomePage) {}
  async open(): Promise<void> { await this.page.open(); }
  async verifyReady(): Promise<void> { await this.page.verifyReady(); }
}
