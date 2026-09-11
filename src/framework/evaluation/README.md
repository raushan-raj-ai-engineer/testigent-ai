# Provider-neutral AI evaluation

The evaluation package deliberately does **not** import DeepEval, LangSmith, or a model-provider SDK. It defines a stable TypeScript contract that adapters can implement.

Recommended flow:

```text
AI/RAG/agent test dataset
  -> deterministic hard gates
  -> optional DeepEval/LangSmith/internal adapter
  -> AiEvaluationRunner (bounded concurrency)
  -> normalized TestigentAI result/reporting
```

This prevents vendor lock-in and lets organizations choose local, cloud, open-source, or managed evaluators per policy.
