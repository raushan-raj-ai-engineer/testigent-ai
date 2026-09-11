/** A reusable AI/agent evaluation case independent of any model or evaluation vendor. */
export interface AiEvaluationCase {
  caseId: string;
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  retrievalContext?: string[];
  metadata?: Record<string, unknown>;
}

/** Normalized result returned by every TestigentAI evaluation metric adapter. */
export interface AiMetricResult {
  metric: string;
  score: number;
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

/** Provider-neutral contract that can wrap deterministic metrics, DeepEval, LangSmith, or an internal service. */
export interface AiEvaluationMetric {
  readonly name: string;
  evaluate(testCase: AiEvaluationCase): Promise<AiMetricResult>;
}

/** Aggregated result for one evaluation case across all configured metrics. */
export interface AiEvaluationResult {
  caseId: string;
  passed: boolean;
  metrics: AiMetricResult[];
}
