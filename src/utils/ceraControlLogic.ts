import type {
  AgentControlsState,
  AgentMode,
  AnalysisDepth,
  CeraAnalysisConfig,
  CeraScopeInput,
  DriftScopeKind,
  IntelligenceSourceId,
} from '../types/agent.ts';
import type {
  CeraOperationState,
  ConsciousSessionState,
  DriftAnalysisRequest,
  DriftSourceScope,
  ForgeFailureStatus,
  ForgeHostContext,
  ForgeNormalizedError,
  SourceConnectionStatus,
  WorkspaceContext,
} from '../types/forge.ts';

export interface IntelligenceSourceDefinition {
  id: IntelligenceSourceId;
  label: string;
  shortLabel: string;
}

export const INTELLIGENCE_SOURCES: readonly IntelligenceSourceDefinition[] = [
  { id: 'jira', label: 'Jira', shortLabel: 'Jira' },
  { id: 'confluence', label: 'Confluence', shortLabel: 'Confluence' },
  { id: 'bitbucket', label: 'Bitbucket', shortLabel: 'Bitbucket' },
  { id: 'jsm', label: 'Jira Service Management', shortLabel: 'JSM' },
  { id: 'teamwork-graph', label: 'Teamwork Graph', shortLabel: 'Teamwork Graph' },
] as const;

export const DEFAULT_SELECTED_SOURCES: readonly IntelligenceSourceId[] = [
  'jira',
  'confluence',
  'bitbucket',
  'jsm',
  'teamwork-graph',
];

export const ANALYSIS_DEPTH_OPTIONS: ReadonlyArray<{
  id: AnalysisDepth;
  label: string;
}> = [
  { id: 'quick', label: 'Quick' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'deep', label: 'Deep' },
];

export const DRIFT_SCOPE_OPTIONS: ReadonlyArray<{
  id: DriftScopeKind;
  label: string;
  placeholder: string;
}> = [
  { id: 'projectKey', label: 'Jira Project', placeholder: 'e.g. CON' },
  { id: 'issueKey', label: 'Jira Issue', placeholder: 'e.g. CON-142' },
  { id: 'spaceKey', label: 'Confluence Space', placeholder: 'e.g. DOCS' },
  { id: 'pageId', label: 'Confluence Page ID', placeholder: 'e.g. 983041' },
  { id: 'repositorySlug', label: 'Bitbucket Repo', placeholder: 'e.g. conscious-core' },
  { id: 'incidentKey', label: 'JSM Incident', placeholder: 'e.g. INC-408' },
];

export function createDefaultScopeInput(
  hostContext: ForgeHostContext | null = null,
  workspaceContext: WorkspaceContext | null = null,
): CeraScopeInput {
  if (hostContext?.issueKey) {
    return { kind: 'issueKey', value: hostContext.issueKey };
  }
  if (workspaceContext?.projectKey) {
    return { kind: 'projectKey', value: workspaceContext.projectKey };
  }
  if (hostContext?.projectKey) {
    return { kind: 'projectKey', value: hostContext.projectKey };
  }
  if (workspaceContext?.spaceKey) {
    return { kind: 'spaceKey', value: workspaceContext.spaceKey };
  }
  if (hostContext?.spaceKey) {
    return { kind: 'spaceKey', value: hostContext.spaceKey };
  }
  if (hostContext?.pageId) {
    return { kind: 'pageId', value: hostContext.pageId };
  }
  if (workspaceContext?.repositorySlug) {
    return { kind: 'repositorySlug', value: workspaceContext.repositorySlug };
  }
  if (workspaceContext?.serviceId) {
    return { kind: 'incidentKey', value: workspaceContext.serviceId };
  }
  return { kind: 'projectKey', value: '' };
}

export function createDefaultControlsState(): AgentControlsState {
  return {
    mode: 'standby',
    finish: 'obsidian',
    explode: 0,
    trackCursor: true,
    motion: 'normal',
  };
}

export function createDefaultAnalysisConfig(
  hostContext: ForgeHostContext | null = null,
  workspaceContext: WorkspaceContext | null = null,
): CeraAnalysisConfig {
  return {
    selectedSources: [...DEFAULT_SELECTED_SOURCES],
    depth: 'balanced',
    scopeInput: createDefaultScopeInput(hostContext, workspaceContext),
  };
}

export function createIdleOperationState<T>(): CeraOperationState<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
    statusMessage: null,
    updatedAt: null,
  };
}

/**
 * Resolves the next agent mode. Activating Sleep when already asleep wakes Cera
 * back to Standby while preserving all other user settings.
 */
export function resolveNextAgentMode(
  currentMode: AgentMode,
  requestedMode: AgentMode,
): AgentMode {
  if (requestedMode === 'sleep' && currentMode === 'sleep') {
    return 'standby';
  }
  return requestedMode;
}

export function toggleIntelligenceSource(
  current: readonly IntelligenceSourceId[],
  sourceId: IntelligenceSourceId,
): IntelligenceSourceId[] {
  if (current.includes(sourceId)) {
    return current.filter((id) => id !== sourceId);
  }
  return INTELLIGENCE_SOURCES.map((item) => item.id).filter(
    (id) => id === sourceId || current.includes(id),
  );
}

/**
 * Derives actual integration connection status exclusively from verified
 * backend WorkspaceContext data—never from user selection state.
 */
export function getSourceConnectionStatus(
  sourceId: IntelligenceSourceId,
  workspaceContext: WorkspaceContext | null,
): SourceConnectionStatus {
  if (!workspaceContext) {
    return 'unverified';
  }

  if (sourceId === 'teamwork-graph') {
    if (typeof workspaceContext.teamworkGraphAvailable === 'boolean') {
      return workspaceContext.teamworkGraphAvailable
        ? 'connected'
        : 'not_connected';
    }
    return 'unverified';
  }

  return workspaceContext.connectedProducts.includes(sourceId)
    ? 'connected'
    : 'not_connected';
}

export function resolveEffectiveScope(
  config: CeraAnalysisConfig,
  workspaceContext: WorkspaceContext | null,
  hostContext: ForgeHostContext | null = null,
): DriftSourceScope {
  const scope: DriftSourceScope = {
    ...(hostContext?.projectKey ? { projectKey: hostContext.projectKey } : {}),
    ...(hostContext?.issueKey ? { issueKey: hostContext.issueKey } : {}),
    ...(hostContext?.spaceKey ? { spaceKey: hostContext.spaceKey } : {}),
    ...(hostContext?.pageId ? { pageId: hostContext.pageId } : {}),
    ...(workspaceContext?.projectKey
      ? { projectKey: workspaceContext.projectKey }
      : {}),
    ...(workspaceContext?.spaceKey
      ? { spaceKey: workspaceContext.spaceKey }
      : {}),
    ...(workspaceContext?.repositorySlug
      ? { repositorySlug: workspaceContext.repositorySlug }
      : {}),
    ...(workspaceContext?.serviceId
      ? { incidentKey: workspaceContext.serviceId }
      : {}),
  };

  const trimmed = config.scopeInput.value.trim();
  if (trimmed) {
    scope[config.scopeInput.kind] = trimmed;
  }

  return scope;
}

export function hasMeaningfulScope(scope: DriftSourceScope): boolean {
  return Boolean(
    scope.projectKey?.trim() ||
      scope.issueKey?.trim() ||
      scope.spaceKey?.trim() ||
      scope.pageId?.trim() ||
      scope.repositorySlug?.trim() ||
      scope.incidentKey?.trim(),
  );
}

export function buildDriftAnalysisRequest(
  config: CeraAnalysisConfig,
  workspaceContext: WorkspaceContext | null,
  hostContext: ForgeHostContext | null = null,
): DriftAnalysisRequest {
  return {
    scope: resolveEffectiveScope(config, workspaceContext, hostContext),
    sources: [...config.selectedSources],
    depth: config.depth,
    includeTeamworkGraph: config.selectedSources.includes('teamwork-graph'),
  };
}

export function formatUnavailableOperationMessage(
  operationLabel: string,
  failureStatus: ForgeFailureStatus,
  error: ForgeNormalizedError,
  session: ConsciousSessionState,
): string {
  if (failureStatus === 'standalone' || session.runtimeMode === 'standalone') {
    return `${operationLabel} is unavailable in standalone local preview. Deploy inside an Atlassian Forge host with backend resolvers to execute.`;
  }

  if (failureStatus === 'not_implemented' || error.code === 'RESOLVER_NOT_IMPLEMENTED') {
    const resolverHint = error.resolverKey ? ` (${error.resolverKey})` : '';
    return `${operationLabel} requires Forge backend integration. Resolver${resolverHint} is pending implementation.`;
  }

  return error.causeMessage ? `${error.message} ${error.causeMessage}` : error.message;
}
