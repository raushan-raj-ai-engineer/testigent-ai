import { test, expect } from '../../fixtures/test.fixture';
import { DataFactory, type DataCase } from '../../../../src/framework/data/data.factory';

interface LoginCase extends DataCase { username: string; password: string; expected: string; }
const cases = new DataFactory().loadCasesSync<LoginCase>('projects/demo/data/cases/login-cases.json');

for (const row of cases) {
  test(`${row.caseId} data row is an independent Playwright test @data @lane:api`, {
    annotation: { type: 'caseId', description: row.caseId },
  }, async ({ dataScope }) => {
    expect(row.username).toBeTruthy();
    expect(dataScope.identity('user', 'attempt')).toContain('demo');
  });
}
