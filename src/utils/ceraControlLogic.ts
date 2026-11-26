import type {
  AgentControlsState,
  AgentMode,
  AnalysisDepth,
  CeraAnalysisConfig,
  IntelligenceSourceId,
} from '../types/agent.ts';
import type {
  CeraOperationState,
  ConsciousSessionState,
  DriftAnalysisRequest,
  ForgeFailureStatus,
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

export function createDefaultControlsState(): AgentControlsState {
  return {
    mode: 'standby',
    finish: 'obsidian',
    explode: 0,
    trackCursor: true,
    motion: 'normal',
  };
}

export function createDefaultAnalysisConfig(): CeraAnalysisConfig {
  return {
    selectedSources: [...DEFAULT_SELECTED_SOURCES],
    depth: 'balanced',
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

export function buildDriftAnalysisRequest(
  config: CeraAnalysisConfig,
  workspaceContext: WorkspaceContext | null,
): DriftAnalysisRequest {
  return {
    scope: {
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
    },
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
