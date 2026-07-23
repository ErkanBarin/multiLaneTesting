// @multilane/cli — authoring lane registry.
//
// Which lanes have an authoring package TODAY. A lane can be a valid runtime lane (see
// `SUPPORTED_LANES` in ../scaffold.mjs) without yet having an authoring package — `mlt authoring
// install` treats that as "not yet available" for that lane, not as an unknown-lane error. See
// LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md for the design this was implemented from.
export const AUTHORING_LANE_PACKAGES = {
  web: '@multilane/authoring-web',
  http: '@multilane/authoring-http',
  stomp: '@multilane/authoring-stomp',
};

export const IMPLEMENTED_AUTHORING_LANES = Object.keys(AUTHORING_LANE_PACKAGES);

// Recognized runtime lanes that do not yet ship an authoring package.
export const PLANNED_AUTHORING_LANES = ['screen'];

export const ALL_KNOWN_LANES = [...IMPLEMENTED_AUTHORING_LANES, ...PLANNED_AUTHORING_LANES];
