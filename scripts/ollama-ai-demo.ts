import 'dotenv/config';
import { OllamaAiProvider } from '../src/framework/ai/ollama-ai.provider';
import { AiGateway } from '../src/framework/ai/ai.gateway';

/**
 * Author: Raushan Raj
 * Business Use: Smoke-tests local AI summarization and structured locator proposal without needing an enterprise application.
 * How to use: AI_ENABLED=true HEALING_AI_ENABLED=true npm run ai:ollama:demo
 * Benefit: Separates AI-provider validation from browser/test failures and makes onboarding easier for freshers.
 */
async function main(): Promise<void> {
  const provider = new OllamaAiProvider();
  const health = await provider.healthCheck();
  console.log(`[health] ${health.message}`);
  if (!health.ok) process.exit(1);

  const gateway = new AiGateway(provider);
  const summary = await gateway.summarizeFailures({
    totals: { total: 100, passed: 94, failed: 6 },
    clusters: [['DEPENDENCY: authentication service returned 503', 5], ['PRODUCT_DEFECT: order total mismatch', 1]]
  });
  console.log('\n[AI business summary]\n' + (summary ?? 'AI summary disabled. Set AI_ENABLED=true.'));

  const locator = await gateway.proposeLocator({
    planId: 'demo.todo.input',
    businessName: 'New work item input',
    allowedDescriptorTypes: ['role', 'label', 'testId', 'placeholder', 'text'],
    accessibilitySnapshot: '- textbox "What needs to be done?"\n- list "Todo items"'
  });
  console.log('\n[AI locator proposal]');
  console.log(locator ?? 'AI locator healing disabled. Set AI_ENABLED=true and HEALING_AI_ENABLED=true.');
  console.log('\n[usage]', gateway.getUsage());
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
