import path from 'node:path';

const app = process.env.APP?.trim() || 'demo';

/** Merge configuration for technical reports collected from project shards. */
export default {
  testDir: '.',
  reporter: [['html', { outputFolder: path.join('reports', app, 'merged-html'), open: 'never' }]],
};
