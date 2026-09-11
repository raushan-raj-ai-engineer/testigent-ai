import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const components = [];
for (const [packagePath, info] of Object.entries(lock.packages ?? {})) {
  if (!packagePath.startsWith('node_modules/') || !info?.version) continue;
  const name = packagePath.slice('node_modules/'.length).replace(/\/node_modules\//g, ' > ');
  const actualName = info.name ?? name.split(' > ').at(-1);
  if (!actualName) continue;
  components.push({
    type: 'library',
    name: actualName,
    version: info.version,
    ...(info.license ? { licenses: [{ license: { id: info.license } }] } : {}),
    ...(info.integrity ? { properties: [{ name: 'npm:integrity', value: info.integrity }] } : {}),
  });
}
components.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: { type: 'application', name: pkg.name, version: pkg.version },
    tools: [{ vendor: 'TestigentAI', name: 'lockfile-sbom-generator', version: '1' }],
  },
  components,
};
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
const output = path.join(root, 'release', 'SBOM.cdx.json');
fs.writeFileSync(output, JSON.stringify(bom, null, 2) + '\n');
console.log(`Wrote ${path.relative(root, output)} with ${components.length} components.`);
