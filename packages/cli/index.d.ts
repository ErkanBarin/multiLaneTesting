// Type definitions for @multilane/cli.

export const SUPPORTED_LANES: string[];

export interface ScaffoldOptions {
  name: string;
  lanes: string[];
  cwd?: string;
  force?: boolean;
}

export function scaffoldProject(options: ScaffoldOptions): { root: string; files: string[] };

// --- authoring ---

export const AUTHORING_LANE_PACKAGES: Record<string, string>;
export const IMPLEMENTED_AUTHORING_LANES: string[];
export const PLANNED_AUTHORING_LANES: string[];
export const ALL_KNOWN_LANES: string[];
export const PROVENANCE_PATH: string;

export interface InstallAuthoringOptions {
  lanes: string[];
  tools?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  force?: boolean;
}

export interface LaneReport {
  lane: string;
  status: 'installed' | 'unavailable' | 'error';
  detail?: string;
  enabled?: string[];
  notEnabled?: Array<{ id: string; reason: string; configureId?: string | null }>;
  record?: object;
}

export function installAuthoring(options: InstallAuthoringOptions): { ok: boolean; laneReports: LaneReport[] };
export function formatInstallReport(laneReports: LaneReport[]): string;

export interface CheckAuthoringIssue {
  lane: string | null;
  type: string;
  detail: string;
}

export function checkAuthoring(options?: { cwd?: string }): { ok: boolean; issues: CheckAuthoringIssue[] };
export function formatCheckReport(result: { ok: boolean; issues: CheckAuthoringIssue[] }): string;

export function updateAuthoring(options: { lanes?: string[]; tools?: string[]; cwd?: string; env?: NodeJS.ProcessEnv }): { ok: boolean; laneReports: LaneReport[] };

export function describeConfigure(configureId: string, options?: { cwd?: string }): string;

export function resolveAuthoringPackage(pkgName: string, options?: { cwd?: string }): { dir: string; pkg: object } | null;

export function readProvenance(cwd?: string): object | null;

