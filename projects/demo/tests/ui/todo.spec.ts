import { test } from '../../fixtures/test.fixture';

test.describe('Todo business journey', () => {
  test('user can create a work item @smoke @ui', async ({ app, logger }, testInfo) => {
    const todo = `Enterprise item ${testInfo.parallelIndex}-${Date.now()}`;

    await test.step('Open the work management application', async () => {
      await app.todo.open();
      await testInfo.attach('business-context.txt', { body: 'Business goal: create and retain a work item.', contentType: 'text/plain' });
      logger.info('BUSINESS_STEP', { step: 'Open application' });
    });

    await test.step('Create a new work item', async () => {
      await app.todo.addTodo(todo);
    });

    await test.step('Verify the work item is visible to the user', async () => {
      await app.todo.verifyTodoVisible(todo);
    });
  });
});
