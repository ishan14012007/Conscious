import { invokeResolver } from './forgeClient';
import type {
  ConfluenceApprovalPayload,
  ConfluenceDocDraft,
  ConfluenceUpdateResult,
  DocDraftRequest,
  DriftAnalysisRequest,
  DriftAnalysisResult,
  DriftEvidenceRequest,
  DriftEvidenceResult,
  ForgeResult,
  WorkspaceContext,
} from '../types/forge';

export const CONSCIOUS_RESOLVERS = {
  getWorkspaceContext: 'getWorkspaceContext',
  runDriftAnalysis: 'runDriftAnalysis',
  fetchDriftEvidence: 'fetchDriftEvidence',
  generateDocDraft: 'generateDocDraft',
  approveAndApplyConfluenceUpdate: 'approveAndApplyConfluenceUpdate',
} as const;

export async function fetchWorkspaceContext(): Promise<ForgeResult<WorkspaceContext>> {
  return invokeResolver<Record<string, never>, WorkspaceContext>(
    CONSCIOUS_RESOLVERS.getWorkspaceContext,
    {},
  );
}

export async function runDriftAnalysis(
  request: DriftAnalysisRequest,
): Promise<ForgeResult<DriftAnalysisResult>> {
  return invokeResolver<{ request: DriftAnalysisRequest }, DriftAnalysisResult>(
    CONSCIOUS_RESOLVERS.runDriftAnalysis,
    { request },
  );
}

export async function fetchDriftEvidence(
  request: DriftEvidenceRequest,
): Promise<ForgeResult<DriftEvidenceResult>> {
  return invokeResolver<{ request: DriftEvidenceRequest }, DriftEvidenceResult>(
    CONSCIOUS_RESOLVERS.fetchDriftEvidence,
    { request },
  );
}

export async function generateDocDraft(
  request: DocDraftRequest,
): Promise<ForgeResult<ConfluenceDocDraft>> {
  return invokeResolver<{ request: DocDraftRequest }, ConfluenceDocDraft>(
    CONSCIOUS_RESOLVERS.generateDocDraft,
    { request },
  );
}

/**
 * Requires an explicit human-confirmed approval payload before invoking the
 * backend resolver. Backend resolver verification and Confluence authorization
 * remain authoritative when backend resolvers are implemented.
 */
export async function approveAndApplyConfluenceUpdate(
  approval: ConfluenceApprovalPayload,
): Promise<ForgeResult<ConfluenceUpdateResult>> {
  if (
    approval.approved !== true ||
    !approval.draftId.trim() ||
    !approval.pageId.trim() ||
    !approval.confirmedAt.trim()
  ) {
    return {
      ok: false,
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        resolverKey: CONSCIOUS_RESOLVERS.approveAndApplyConfluenceUpdate,
        message:
          'Explicit human approval metadata (approved=true, draftId, pageId, confirmedAt) is required before applying a Confluence update.',
      },
    };
  }

  return invokeResolver<
    { approval: ConfluenceApprovalPayload },
    ConfluenceUpdateResult
  >(CONSCIOUS_RESOLVERS.approveAndApplyConfluenceUpdate, { approval });
}
