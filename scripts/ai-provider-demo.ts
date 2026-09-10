import 'dotenv/config';
import { createAiGateway, createAiProvider } from '../src/framework/ai/ai-provider.factory';

/**
 * Author: Raushan Raj
 * Business Use: Provider-neutral smoke test for AI summary + structured self-healing locator proposal.
 * How to use: Configure AI_PROVIDER and credentials, then npm run ai:demo.
 * Benefit: The same validation works for Ollama, OpenAI, Claude, Azure OpenAI, Gemini and compatible gateways.
 */
async function main(): Promise<void> {
  const provider = createAiProvider();
  const gateway = createAiGateway();
  if (!provider || !gateway) throw new Error('Set AI_ENABLED=true before running the AI demo.');

  if (provider.healthCheck) {
    const health = await provider.healthCheck();
    console.log(`[health] ${health.message}`);
    if (!health.ok) process.exit(1);
  }

  const summary = await gateway.summarizeFailures({
    totals: { total: 100, passed: 94, failed: 6, passRate: 94 },
    healing: { total: 0, ai: 0 },
    clusters: [
      { evidence: 'Authentication service returned HTTP 503', affectedTests: 5 },
      { evidence: 'Order total assertion mismatch', affectedTests: 1 }
    ]
  });
  console.log('\n[AI business summary]\n' + (summary ?? 'No summary returned.'));

  const locator = await gateway.proposeLocator({
    planId: 'demo.todo.input',
    businessName: 'New work item input',
    allowedDescriptorTypes: ['role', 'label', 'testId', 'placeholder', 'text'],
    accessibilitySnapshot: '- textbox "What needs to be done?"\n- list "Todo items"'
  });
  console.log('\n[AI locator proposal]');
  console.log(locator ?? 'No locator returned.');
  console.log('\n[usage]', gateway.getUsage());
}

main().catch(error => { console.error(error); process.exitCode = 1; });
