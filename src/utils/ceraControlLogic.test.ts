import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDriftAnalysisRequest,
  createDefaultAnalysisConfig,
  createDefaultControlsState,
  createDefaultScopeInput,
  formatUnavailableOperationMessage,
  getSourceConnectionStatus,
  hasMeaningfulScope,
  INTELLIGENCE_SOURCES,
  resolveEffectiveScope,
  resolveNextAgentMode,
  toggleIntelligenceSource,
} from './ceraControlLogic.ts';
import type { ConsciousSessionState, ForgeHostContext, WorkspaceContext } from '../types/forge.ts';

test('default controls and analysis configuration preserve clean initial state', () => {
  const controls = createDefaultControlsState();
  const analysis = createDefaultAnalysisConfig();

  assert.equal(controls.mode, 'standby');
  assert.equal(controls.trackCursor, true);
  assert.equal(controls.motion, 'normal');
  assert.equal(analysis.depth, 'balanced');
  assert.deepEqual(analysis.scopeInput, { kind: 'projectKey', value: '' });
  assert.deepEqual(analysis.selectedSources, [
    'jira',
    'confluence',
    'bitbucket',
    'jsm',
    'teamwork-graph',
  ]);
});

test('Sleep mode returns to Standby when activated again and preserves user settings', () => {
  const initialControls = {
    ...createDefaultControlsState(),
    trackCursor: false,
    motion: 'reduced' as const,
  };

  const sleepingMode = resolveNextAgentMode(initialControls.mode, 'sleep');
  assert.equal(sleepingMode, 'sleep');

  // Re-activating Sleep returns Cera to Standby
  const wokenMode = resolveNextAgentMode(sleepingMode, 'sleep');
  assert.equal(wokenMode, 'standby');

  // Other user settings remain unchanged
  assert.equal(initialControls.trackCursor, false);
  assert.equal(initialControls.motion, 'reduced');
});

test('Intelligence source selection is distinct from verified connection status', () => {
  assert.equal(INTELLIGENCE_SOURCES.length, 5);

  // When WorkspaceContext is null (standalone or backend pending), selecting a source
  // must never report it as connected
  for (const source of INTELLIGENCE_SOURCES) {
    assert.equal(getSourceConnectionStatus(source.id, null), 'unverified');
  }

  // When WorkspaceContext exists, only backend-verified products report connected
  const workspace: WorkspaceContext = {
    host: { mode: 'forge', product: 'jira' },
    connectedProducts: ['jira', 'confluence'],
    teamworkGraphAvailable: false,
    projectKey: 'CON',
  };

  assert.equal(getSourceConnectionStatus('jira', workspace), 'connected');
  assert.equal(getSourceConnectionStatus('confluence', workspace), 'connected');
  assert.equal(getSourceConnectionStatus('bitbucket', workspace), 'not_connected');
  assert.equal(getSourceConnectionStatus('jsm', workspace), 'not_connected');
  assert.equal(
    getSourceConnectionStatus('teamwork-graph', workspace),
    'not_connected',
  );
});

test('toggling sources updates DriftAnalysisRequest with selected sources and depth', () => {
  let selected = createDefaultAnalysisConfig().selectedSources;
  selected = toggleIntelligenceSource(selected, 'bitbucket');
  selected = toggleIntelligenceSource(selected, 'teamwork-graph');

  assert.deepEqual(selected, ['jira', 'confluence', 'jsm']);

  const request = buildDriftAnalysisRequest(
    {
      selectedSources: selected,
      depth: 'deep',
      scopeInput: { kind: 'projectKey', value: '' },
    },
    {
      host: { mode: 'forge', product: 'jira' },
      connectedProducts: ['jira'],
      projectKey: 'ENG',
      spaceKey: 'DOCS',
    },
  );

  assert.deepEqual(request, {
    scope: {
      projectKey: 'ENG',
      spaceKey: 'DOCS',
    },
    sources: ['jira', 'confluence', 'jsm'],
    depth: 'deep',
    includeTeamworkGraph: false,
  });

  // Re-enabling Teamwork Graph sets includeTeamworkGraph true
  const reEnabled = toggleIntelligenceSource(selected, 'teamwork-graph');
  const updatedRequest = buildDriftAnalysisRequest(
    {
      selectedSources: reEnabled,
      depth: 'quick',
      scopeInput: { kind: 'issueKey', value: 'CON-42' },
    },
    null,
  );
  assert.equal(updatedRequest.depth, 'quick');
  assert.equal(updatedRequest.includeTeamworkGraph, true);
  assert.deepEqual(updatedRequest.scope, { issueKey: 'CON-42' });
  assert.deepEqual(updatedRequest.sources, [
    'jira',
    'confluence',
    'jsm',
    'teamwork-graph',
  ]);
});

test('scope resolution prefers active Jira context and enforces meaningful scope', () => {
  assert.equal(hasMeaningfulScope({}), false);
  assert.equal(hasMeaningfulScope({ projectKey: '   ' }), false);
  assert.equal(hasMeaningfulScope({ projectKey: 'CON' }), true);
  assert.equal(hasMeaningfulScope({ issueKey: 'CON-101' }), true);

  const jiraHostContext: ForgeHostContext = {
    mode: 'forge',
    product: 'jira',
    projectKey: 'CON',
    issueKey: 'CON-101',
  };

  const defaultScopeInput = createDefaultScopeInput(jiraHostContext, null);
  assert.deepEqual(defaultScopeInput, { kind: 'issueKey', value: 'CON-101' });

  const resolvedScope = resolveEffectiveScope(
    {
      selectedSources: ['jira', 'confluence'],
      depth: 'balanced',
      scopeInput: { kind: 'spaceKey', value: '  ARCH  ' },
    },
    null,
    jiraHostContext,
  );

  assert.deepEqual(resolvedScope, {
    projectKey: 'CON',
    issueKey: 'CON-101',
    spaceKey: 'ARCH',
  });
  assert.equal(hasMeaningfulScope(resolvedScope), true);
});

test('unavailable backend operations report clear standalone or pending resolver messages', () => {
  const standaloneSession: ConsciousSessionState = {
    runtimeMode: 'standalone',
    workflowStage: 'standalone',
    hostContext: { mode: 'standalone', product: 'unknown' },
    workspaceContext: null,
    lastError: null,
  };

  const standaloneMsg = formatUnavailableOperationMessage(
    'Drift check',
    'standalone',
    {
      code: 'STANDALONE_UNAVAILABLE',
      resolverKey: 'runDriftAnalysis',
      message: 'Unavailable in standalone mode',
    },
    standaloneSession,
  );
  assert.match(standaloneMsg, /standalone/i);
  assert.match(standaloneMsg, /Atlassian Forge/i);

  const forgePendingSession: ConsciousSessionState = {
    runtimeMode: 'forge',
    workflowStage: 'backend_pending',
    hostContext: { mode: 'forge', product: 'jira' },
    workspaceContext: null,
    lastError: null,
  };

  const pendingMsg = formatUnavailableOperationMessage(
    'Drift check',
    'not_implemented',
    {
      code: 'RESOLVER_NOT_IMPLEMENTED',
      resolverKey: 'runDriftAnalysis',
      message: 'Not implemented',
    },
    forgePendingSession,
  );
  assert.match(pendingMsg, /pending implementation/i);
  assert.match(pendingMsg, /runDriftAnalysis/);
});
