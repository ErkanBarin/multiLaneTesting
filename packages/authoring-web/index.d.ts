export interface LaneAgentManifestEntry {
  id: string;
  title: string;
  kind: 'agent';
  portable: 'portable-now' | 'portable-after-path-parameterization' | 'portable-after-mcp-config' | 'engine-maintainer-only' | 'obsolete';
  always: boolean;
  source: string;
  requires?: { mcpServers?: string[]; env?: string[]; tools?: string[] };
  targets: Record<string, { path: string; format: string }>;
}

export interface LaneSkillManifestEntry {
  id: string;
  title: string;
  kind: 'skill';
  portable: 'portable-now' | 'portable-after-path-parameterization' | 'portable-after-mcp-config' | 'engine-maintainer-only' | 'obsolete';
  always: boolean;
  source: string;
  requires?: { mcpServers?: string[]; env?: string[]; tools?: string[] };
  targets: Record<string, { path: string; format: string }>;
}

export interface LaneManifest {
  lane: string;
  version: string;
  runtimePackage: string;
  authoringPackage: string;
  compatibility: { minRuntimeVersion: string; maxRuntimeVersion: string };
  skills: LaneSkillManifestEntry[];
  agents: LaneAgentManifestEntry[];
  requiredTools: string[];
  optionalMcpServers: string[];
  envPrerequisites: string[];
}

export function loadLaneManifest(): LaneManifest;
export const laneManifestPath: string;
export const assetsRoot: string;
