#!/usr/bin/env groovy
// runLaneTests — reusable multilanetesting pipeline step (Jenkins Shared Library).
//
// A per-system Jenkinsfile stays thin and calls this with parameters; all logic lives here so jobs
// do not repeat themselves.
//
//   @Library('multilane-jenkins') _
//   runLaneTests(lanes: 'web,http', targetUrl: params.TARGET_URL, nodeVersion: '22.11.0')
//
// ─── Design notes ────────────────────────────────────────────────────────────────────────────────
//  • NO DOCKER. This pass runs directly on the agent. Clean seams are kept so a single lane can be
//    wrapped in a container later without reworking the engine.
//  • AGENT-AGNOSTIC. Works whether agents are:
//      – STATIC   (Node + browsers pre-installed): the NodeJS-tool / nvm steps detect and reuse them.
//      – EPHEMERAL (fresh each build): Node is provisioned via the Jenkins NodeJS tool or an nvm
//        fallback, and Playwright browsers are installed on demand.
//    It DETECTS and DEGRADES rather than hardcoding one assumption. Pass `agentLabel` to pin agents,
//    or leave it empty to run on any agent.
//  • PROXY / NEXUS AWARE. `.npmrc` is written from environment variables (never committed secrets);
//    npm and Playwright downloads route through the corporate proxy via HTTP(S)_PROXY.
//  • CHROMIUM CAVEAT (documented, not solved). On locked-down Linux agents without root, Chromium may
//    be missing shared system libraries. `--with-deps` is intentionally NOT used (it needs root). If
//    the browser cannot install/launch, the web lane is marked UNSTABLE with a TODO(containerize-later)
//    marker — that lane is the trigger to containerize in a FUTURE pass. Do not add Docker here.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

def call(Map config = [:]) {
  List lanes = ((config.lanes ?: '') as String).tokenize(',').collect { it.trim() }.findAll { it }
  String targetUrl = (config.targetUrl ?: '') as String
  String nodeVersion = (config.nodeVersion ?: '22.11.0') as String
  String agentLabel = (config.agentLabel ?: '') as String

  pipeline {
    agent { label agentLabel }

    options {
      timestamps()
      disableConcurrentBuilds()
      buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
      // Target under test — drives the web lane baseURL and is available to every lane.
      MULTILANE_WEB_BASE_URL = "${targetUrl}"
      // Registry + proxy are inherited from the agent/credentials environment; never hardcoded here.
      // Expected (provide via Jenkins credentials/global env):
      //   NEXUS_NPM_REGISTRY_URL, NEXUS_NPM_REGISTRY_AUTH_HOST, NEXUS_NPM_AUTH_TOKEN
      //   HTTP_PROXY, HTTPS_PROXY, NO_PROXY
      CI = 'true'
    }

    stages {
      stage('Checkout') {
        steps { checkout scm }
      }

      stage('Ensure Node') {
        steps { script { ensureNode(nodeVersion) } }
      }

      stage('Configure registry (.npmrc)') {
        steps { script { writeNpmrc() } }
      }

      stage('Install deps (npm ci)') {
        steps { sh 'npm ci' }
      }

      stage('Playwright browsers') {
        when { expression { lanes.contains('web') } }
        steps { script { installChromium() } }
      }

      stage('Verify (deterministic gates)') {
        // mlt verify == no-runtime-ai + robot-contract. No AI, no network model calls.
        steps { sh 'npx --no-install mlt verify' }
      }

      stage('Run requested lanes') {
        steps { script { runRequestedLanes(lanes) } }
      }
    }

    post {
      always {
        junit allowEmptyResults: true, testResults: 'results/**/*.xml, **/junit-*.xml, **/junit.xml'
        archiveArtifacts(
          artifacts: 'results/**, playwright-report/**, test-results/**, artifacts/**',
          allowEmptyArchive: true,
          fingerprint: false,
        )
      }
    }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────────────────────────

// Provision Node without assuming a specific agent shape.
void ensureNode(String nodeVersion) {
  // 1) Prefer a configured Jenkins NodeJS tool (works on static and ephemeral agents).
  try {
    String nodeHome = tool(name: "node-${nodeVersion}", type: 'nodejs')
    env.PATH = "${nodeHome}/bin:${env.PATH}"
    echo "Using Jenkins NodeJS tool 'node-${nodeVersion}'."
  } catch (ignored) {
    echo "NodeJS tool 'node-${nodeVersion}' not configured — will use Node on PATH or nvm."
  }

  // 2) If Node is already on PATH (static agent), reuse it.
  if (sh(script: 'command -v node >/dev/null 2>&1', returnStatus: true) == 0) {
    sh 'node --version'
    return
  }

  // 3) nvm fallback (documented). Requires nvm on the agent; provisions the pinned version.
  echo "Node not found on PATH — attempting nvm fallback for ${nodeVersion}."
  sh """
    set -e
    export NVM_DIR="\${NVM_DIR:-\$HOME/.nvm}"
    if [ -s "\$NVM_DIR/nvm.sh" ]; then
      . "\$NVM_DIR/nvm.sh"
      nvm install ${nodeVersion}
      nvm use ${nodeVersion}
      node --version
    else
      echo 'ERROR: no Node on PATH, no Jenkins NodeJS tool, and no nvm on this agent.'
      echo 'Install the NodeJS plugin tool "node-${nodeVersion}" or provide nvm/Node on the agent.'
      exit 1
    fi
  """
}

// Write .npmrc from the environment. npm expands ${VAR} at read time, so no secret is materialised
// in SCM or the workspace beyond this ephemeral file.
void writeNpmrc() {
  writeFile file: '.npmrc', text: '''@multilane:registry=${NEXUS_NPM_REGISTRY_URL}
${NEXUS_NPM_REGISTRY_AUTH_HOST}:_authToken=${NEXUS_NPM_AUTH_TOKEN}
always-auth=true
'''
  echo 'Wrote .npmrc (scope @multilane -> Nexus). Proxy is read from HTTP(S)_PROXY.'
}

// Install only the Chromium browser, routed through the proxy. Deliberately NOT --with-deps.
void installChromium() {
  // catchError degrades the web lane to UNSTABLE instead of failing the whole build.
  catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
    int rc = sh(script: 'npx --no-install playwright install chromium', returnStatus: true)
    if (rc != 0) {
      echo '''TODO(containerize-later): Playwright Chromium failed to install/launch on this agent.
On locked-down Linux agents without root, Chromium is often missing shared system libraries and
`--with-deps` cannot be used. This lane is the trigger to CONTAINERIZE the web lane in a future pass.
Do NOT add Docker in this pass. The web lane is marked UNSTABLE for this build.'''
      error 'Chromium unavailable on this agent (see TODO(containerize-later)).'
    }
  }
}

// Run only the lanes requested by the caller.
void runRequestedLanes(List lanes) {
  if (lanes.contains('web')) {
    // Wrapped so a missing browser (see caveat) does not fail sibling lanes.
    catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
      sh 'npm run test:web'
    }
  }
  if (lanes.contains('http')) {
    sh 'npm run test:http'
  }
  if (lanes.contains('stomp')) {
    sh 'npm run test:stomp'
  }
  if (lanes.contains('screen')) {
    sh 'npm run test:screen'
  }
}

return this
