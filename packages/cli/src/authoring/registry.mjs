// @erkanbarin/cli — authoring lane registry.
//
// Which lanes have an authoring package TODAY. A lane can be a valid runtime lane (see
// `SUPPORTED_LANES` in ../scaffold.mjs) without yet having an authoring package — `mlt authoring
// install` treats that as "not yet available" for that lane, not as an unknown-lane error. See
// LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md for the design this was implemented from.
export const AUTHORING_LANE_PACKAGES = {
  web: '@erkanbarin/authoring-web',
  http: '@erkanbarin/authoring-http',
  stomp: '@erkanbarin/authoring-stomp',
  screen: '@erkanbarin/authoring-screen',
  snmp: '@erkanbarin/authoring-snmp',
  trap: '@erkanbarin/authoring-trap',
};

export const IMPLEMENTED_AUTHORING_LANES = Object.keys(AUTHORING_LANE_PACKAGES);

// Recognized runtime lanes that do not yet ship an authoring package. Empty since 2026-09-21, when
// screen/snmp/trap shipped theirs — every lane in `SUPPORTED_LANES` now has an authoring package.
// The constant and the "unavailable" path in install.mjs stay: `SUPPORTED_LANES` is the runtime
// vocabulary and an authoring package is a separate deliverable, so the next runtime lane lands here
// first. Emptying it is not a reason to delete the code path that reads it.
export const PLANNED_AUTHORING_LANES = [];

export const ALL_KNOWN_LANES = [...IMPLEMENTED_AUTHORING_LANES, ...PLANNED_AUTHORING_LANES];
