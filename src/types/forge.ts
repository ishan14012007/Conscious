import type { AnalysisDepth, IntelligenceSourceId } from './agent';

export type ForgeRuntimeMode = 'checking' | 'forge' | 'standalone';

export type ForgeHostProduct =
  | 'jira'
  | 'confluence'
  | 'jsm'
  | 'bitbucket'
  | 'unknown';

export interface ForgeHostContext {
  mode: Exclude<ForgeRuntimeMode, 'checking'>;
  product: ForgeHostProduct;
  cloudId?: string;
  workspaceId?: string;
  accountId?: string;
  siteUrl?: string;
  moduleKey?: string;
  environmentType?: string;
  locale?: string;
  timezone?: string;
  extensionType?: string;
}

export type ForgeErrorCode =
  | 'STANDALONE_UNAVAILABLE'
  | 'RESOLVER_NOT_IMPLEMENTED'
  | 'BRIDGE_ERROR'
  | 'VALIDATION_ERROR';

export type ForgeFailureStatus = 'standalone' | 'not_implemented' | 'error';

export interface ForgeNormalizedError {
  code: ForgeErrorCode;
  message: string;
  resolverKey?: string;
  causeMessage?: string;
}

export type ForgeResult<T> =
  | {
      ok: true;
      status: 'ok';
      data: T;
    }
  | {
      ok: false;
      status: ForgeFailureStatus;
      error: ForgeNormalizedError;
    };

export interface WorkspaceContext {
  host: ForgeHostContext;
  connectedProducts: ForgeHostProduct[];
  teamworkGraphAvailable?: boolean;
  projectKey?: string;
  spaceKey?: string;
  repositorySlug?: string;
  serviceId?: string;
}

export interface DriftSourceScope {
  projectKey?: string;
  spaceKey?: string;
  repositorySlug?: string;
  issueKey?: string;
  pageId?: string;
  incidentKey?: string;
}

export interface DriftAnalysisRequest {
  scope: DriftSourceScope;
  sources: IntelligenceSourceId[];
  depth: AnalysisDepth;
  includeTeamworkGraph?: boolean;
}

export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftAnalysisFinding {
  id: string;
  title: string;
  summary: string;
  severity: DriftSeverity;
  affectedPageId?: string;
  sourceRefs: string[];
}

export interface DriftAnalysisResult {
  analysisId: string;
  analyzedAt: string;
  findings: DriftAnalysisFinding[];
}

export interface DriftEvidenceRequest {
  analysisId: string;
  findingId?: string;
}

export interface DriftEvidenceItem {
  id: string;
  sourceProduct: ForgeHostProduct;
  sourceRef: string;
  excerpt: string;
  capturedAt?: string;
}

export interface DriftEvidenceResult {
  analysisId: string;
  items: DriftEvidenceItem[];
}

export interface DocDraftRequest {
  analysisId: string;
  findingId: string;
  pageId: string;
  instructions?: string;
}

export interface ConfluenceDocDraft {
  draftId: string;
  pageId: string;
  pageTitle?: string;
  baseVersion?: number;
  summaryOfChanges: string;
  proposedContent: string;
  generatedAt: string;
}

export interface ConfluenceApprovalPayload {
  approved: true;
  draftId: string;
  pageId: string;
  expectedVersion?: number;
  confirmedByAccountId?: string;
  confirmedAt: string;
  approvalNote?: string;
}

export interface ConfluenceUpdateResult {
  pageId: string;
  draftId: string;
  updatedVersion?: number;
  appliedAt: string;
}

export type ConsciousWorkflowStage =
  | 'initializing'
  | 'standalone'
  | 'ready'
  | 'backend_pending'
  | 'error';

export interface ConsciousSessionState {
  runtimeMode: ForgeRuntimeMode;
  workflowStage: ConsciousWorkflowStage;
  hostContext: ForgeHostContext | null;
  workspaceContext: WorkspaceContext | null;
  lastError: ForgeNormalizedError | null;
}

export type CeraOperationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'unavailable'
  | 'error';

export interface CeraOperationState<T> {
  status: CeraOperationStatus;
  data: T | null;
  error: ForgeNormalizedError | null;
  statusMessage: string | null;
  updatedAt: string | null;
}

export type CeraQuickActionKey = 'drift' | 'pending' | 'findings';

export type SourceConnectionStatus =
  | 'connected'
  | 'not_connected'
  | 'unverified';
