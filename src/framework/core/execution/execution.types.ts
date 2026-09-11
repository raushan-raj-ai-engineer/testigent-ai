/** Test execution lanes used to isolate capabilities and CI policies. */
export type TestLane = 'ui' | 'api' | 'db' | 'e2e' | 'ai' | 'visual' | 'accessibility' | 'performance';

/** Named execution profiles shipped by TestigentAI. */
export type ExecutionProfileName = 'pr' | 'smoke' | 'regression' | 'nightly' | 'release' | 'custom';

/** Playwright worker setting: an absolute count or a percentage of logical CPUs. */
export type WorkerSetting = number | `${number}%`;

/** Mutable execution settings that can be overridden at each configuration layer. */
export interface ExecutionSettings {
  workers?: WorkerSetting;
  retries?: number;
  maxFailures?: number;
  fullyParallel?: boolean;
  timeoutMs?: number;
  expectTimeoutMs?: number;
  actionTimeoutMs?: number;
  navigationTimeoutMs?: number;
  includeTags?: string[];
  excludeTags?: string[];
  allowedLanes?: TestLane[];
  allowAi?: boolean;
  allowGenerated?: boolean;
  allowManual?: boolean;
  durationBalancing?: 'native' | 'history';
}

/** Configuration file shape shared by organization, project and environment layers. */
export interface ExecutionConfigLayer {
  execution?: ExecutionSettings;
  profiles?: Partial<Record<ExecutionProfileName, ExecutionSettings>>;
}

/** Fully resolved execution policy consumed by Playwright and CLI runners. */
export interface ResolvedExecutionPolicy extends Required<Pick<ExecutionSettings,
  'workers' | 'retries' | 'maxFailures' | 'fullyParallel' | 'timeoutMs' | 'expectTimeoutMs' |
  'actionTimeoutMs' | 'navigationTimeoutMs' | 'allowAi' | 'allowGenerated' | 'allowManual' |
  'durationBalancing'>> {
  profile: ExecutionProfileName;
  lane?: TestLane;
  includeTags: string[];
  excludeTags: string[];
  allowedLanes: TestLane[];
  sources: string[];
}
