import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test.describe(
  'external demo isolation contract',
  () => {
    test.skip(
      process.env.RUN_FRAMEWORK_TESTS !== 'true',
      'Framework contract test.',
    );

    test(
      'public demo integrations do not block deterministic certification',
      async () => {
        const files = [
          'projects/demo/tests/_agent/seed.spec.ts',
          'projects/demo/tests/quality/accessibility.smoke.spec.ts',
          'projects/demo/tests/quality/declarative.scenario.spec.ts',
          'projects/demo/tests/quality/performance.budget.spec.ts',
          'projects/demo/tests/ui/todo.spec.ts',
          'projects/demo/tests/api/user.api.spec.ts',
        ];

        for (const file of files) {
          const source = await readFile(
            join(process.cwd(), file),
            'utf8',
          );

          expect(
            source,
            `${file} must be guarded as an external integration`,
          ).toContain('RUN_EXTERNAL_TESTS');
        }

        const pkg = JSON.parse(
          await readFile(
            join(process.cwd(), 'package.json'),
            'utf8',
          ),
        );

        expect(pkg.scripts['test:external']).toContain(
          'RUN_EXTERNAL_TESTS=true',
        );
      },
    );
  },
);
