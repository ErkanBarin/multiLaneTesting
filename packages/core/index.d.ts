// Type definitions for @multilane/core.

export interface WebConfig {
  baseUrl: string;
}
export interface HttpConfig {
  enabled: boolean;
  host: string;
  approvedHosts: string[];
}
export interface WsConfig {
  enabled: boolean;
  inject: boolean;
  url: string;
  approvedHosts: string[];
}
export interface ScreenConfig {
  host: string;
  partition: string;
  display: string;
}
export interface MultilaneConfig {
  web: WebConfig;
  http: HttpConfig;
  ws: WsConfig;
  screen: ScreenConfig;
}
export interface ProjectConfig {
  runtimeDirs: string[];
  authoringDirs: string[];
  specDir: string;
  contractDoc: string;
  robotTags: string[];
  lanes: string[];
}

export interface NoRuntimeAiResult {
  ok: boolean;
  scanned: number;
  violations: Array<{ path: string; pattern: string }>;
}
export interface RobotContractResult {
  ok: boolean;
  specTags: string[];
  errors: string[];
}
export interface VerifyResult {
  ok: boolean;
  gates: Array<{ name: string; ok: boolean; detail: string }>;
}
export interface ScreenPartitionResult {
  ok: boolean;
  active: boolean;
  partition: string | null;
  error?: string;
}

export const DEFAULT_RUNTIME_DIRS: string[];
export const DEFAULT_AUTHORING_DIRS: string[];
export const DEFAULT_SPEC_DIR: string;
export const DEFAULT_CONTRACT_DOC: string;
export const FORBIDDEN_RUNTIME_PATTERNS: RegExp[];

export function loadConfig(env?: Record<string, string | undefined>): MultilaneConfig;
export function assertTestPartition(config: MultilaneConfig): string;
export function loadProjectConfig(cwd?: string): ProjectConfig;

export function runNoRuntimeAiGate(options?: {
  cwd?: string;
  runtimeDirs?: string[];
  authoringDirs?: string[];
  forbidden?: RegExp[];
}): NoRuntimeAiResult;
export function reportNoRuntimeAi(result: NoRuntimeAiResult): boolean;

export function runRobotContractGate(options?: {
  cwd?: string;
  specDir?: string;
  contractDoc?: string;
  tags?: string[];
}): RobotContractResult;
export function reportRobotContract(result: RobotContractResult): boolean;

export function runScreenPartitionGate(options?: {
  env?: Record<string, string | undefined>;
  lanes?: string[];
}): ScreenPartitionResult;
export function reportScreenPartition(result: ScreenPartitionResult): boolean;

export function runVerify(options?: { cwd?: string; env?: Record<string, string | undefined> }): VerifyResult;
export function printVerifyTable(result: VerifyResult): boolean;
