import 'dotenv/config';
import { OllamaAiProvider } from '../src/framework/ai/ollama-ai.provider';

/**
 * Author: Raushan Raj
 * Business Use: Pre-flight validation that local Ollama and the configured model are available before AI-enabled execution.
 * How to use: npm run ai:ollama:check
 * Benefit: Fails fast with an actionable message instead of discovering missing AI infrastructure during a healing event.
 */
async function main(): Promise<void> {
  const provider = new OllamaAiProvider();
  const result = await provider.healthCheck();
  console.log(result.message);
  if (!result.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
