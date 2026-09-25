// Type definitions for @multilane/screen.

export interface FrozenLocator {
  area: string;
  key: string;
  tier: 1 | 2;
  resolver: string;
  requirement_ref: string;
  stamp?: { dpi?: number; resolution?: string; theme?: string };
  last_verified?: string;
  [extra: string]: unknown;
}

export function loadFrozenLocator(
  area: string,
  key: string,
  options?: { cwd?: string; locatorsDir?: string; env?: Record<string, string | undefined> },
): FrozenLocator;

export function assertFrozen(locator: unknown): { ok: boolean; errors: string[] };

/** Names of the driver scripts shipped under `driver/`. */
export type DriverScriptName = 'atspiBridge' | 'menuActuate' | 'framebuffer';

export const DRIVER_SCRIPTS: Readonly<Record<DriverScriptName, string>>;

/** Absolute path to one of the `driver/` scripts. */
export function driverScriptPath(name: DriverScriptName): string;

/** Interpreter to run the driver scripts with (`gi` is a system package, never a venv one). */
export function resolvePythonBin(env?: Record<string, string | undefined>): string;

/** Thrown by runDriver on a non-zero exit: 1 not found / mismatch, 2 bad arguments, 3 host unusable. */
export interface DriverError extends Error {
  exitCode: number;
  result: Record<string, unknown>;
}

/**
 * Run a driver script and return its parsed JSON answer (each command has its own shape — see the
 * script's docstring); throws a DriverError on any failure.
 */
export function runDriver(
  name: DriverScriptName,
  args: Array<string | number>,
  options?: { env?: Record<string, string | undefined>; cwd?: string },
): any;

export type ViewerProtocol = 'vnc' | 'rdp';

/** The viewer program and arguments openViewer runs for a protocol. */
export function viewerCommand(
  protocol: ViewerProtocol,
  host: string,
  options?: { user?: string; program?: string; args?: string[] },
): [string, string[]];

export interface Viewer {
  display: string;
  protocol: ViewerProtocol;
  width: number;
  height: number;
  /** The caller's environment with DISPLAY pointed at the viewer: pass it to runDriver. */
  env: Record<string, string | undefined>;
  /** Stop the viewer, and Xvfb when openViewer started it. */
  close(): Promise<void>;
}

/** Show a VNC/RDP target full-screen on a local X display. Refuses when the partition is PROD. */
export function openViewer(options?: {
  protocol?: ViewerProtocol;
  host?: string;
  display?: string;
  geometry?: string;
  args?: string[];
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
}): Promise<Viewer>;
