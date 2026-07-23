// @multilane/cli — content digest helper for authoring provenance.
//
// A digest detects DRIFT (a file changed since install) — it is not cryptographic publisher
// authentication. Supply-chain trust for the package itself comes from npm package integrity
// (package-lock `integrity` hashes) and registry access controls, not this digest.
import { createHash } from 'node:crypto';

/** Deterministic sha256 digest of a string, prefixed so the algorithm is explicit in provenance. */
export function digestContent(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}
