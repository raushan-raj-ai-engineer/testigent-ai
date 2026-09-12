import path from 'node:path';

const app = process.env.APP?.trim();
if (!app) throw new Error('APP is required to merge Playwright technical reports. Select a project explicitly before report merge.');

/** Merge configuration for technical reports collected from project shards and dedicated AI/healing jobs. */
export default {
  testDir: '.',
  reporter: [['html', { outputFolder: path.join('reports', app, 'merged-html'), open: 'never' }]],
};
