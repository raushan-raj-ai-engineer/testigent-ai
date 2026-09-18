import { expect, test } from '@playwright/test';
import {
  guidedCaptureScript,
  type GuidedEvent,
} from '../../src/framework/intelligence/exploration/complex.capture.js';

test.describe('guided browser capture contract', () => {
  test.skip(
    process.env.RUN_FRAMEWORK_TESTS !== 'true',
    'Framework contract test.',
  );

  test('captures text input and Enter with placeholder semantics', async ({ page }) => {
    const events: GuidedEvent[] = [];

    await page.exposeFunction('__knowledgeEvent', async (event: GuidedEvent) => {
      events.push(event);
    });

    await page.addInitScript({
      content: guidedCaptureScript(),
    });

    await page.goto(
      `data:text/html,${encodeURIComponent(`
        <!doctype html>
        <html>
          <body>
            <input
              type="text"
              placeholder="What needs to be done?"
            />
          </body>
        </html>
      `)}`,
    );

    const input = page.getByPlaceholder('What needs to be done?');

    await input.fill('Testigent AI Todo');
    await input.press('Enter');

    await page.waitForTimeout(300);

    const inputEvent = events.find(event => event.type === 'input');
    const keyEvent = events.find(event => event.type === 'key');

    expect(inputEvent).toBeTruthy();
    expect(keyEvent).toBeTruthy();
    expect(keyEvent?.detail.key).toBe('Enter');

    const candidates =
      (inputEvent?.target.locatorCandidates ?? []) as Array<{
        kind: string;
        value: string;
      }>;

    expect(candidates).toContainEqual(
      expect.objectContaining({
        kind: 'placeholder',
        value: 'What needs to be done?',
      }),
    );

    expect(
      candidates.some(
        candidate =>
          candidate.kind === 'role' &&
          candidate.value === 'What needs to be done?',
      ),
    ).toBe(false);
  });
});
