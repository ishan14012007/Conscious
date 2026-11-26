import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { WorkspaceConnectionsModal } from './components/WorkspaceConnectionsModal';
import {
  approveAndApplyConfluenceUpdate,
  fetchDriftEvidence,
  fetchWorkspaceContext,
  generateDocDraft,
  runDriftAnalysis,
} from './services/consciousApi';
import { getHostContext } from './services/forgeClient';
import {
  AgentControlsState,
  AgentMode,
  AgentMotionMode,
  AnalysisDepth,
  CeraAnalysisConfig,
  CeraScopeInput,
  IntelligenceSourceId,
} from './types/agent';
import type {
  CeraOperationState,
  CeraQuickActionKey,
  ConfluenceDocDraft,
  ConfluenceUpdateResult,
  ConsciousSessionState,
  DriftAnalysisResult,
  DriftEvidenceResult,
  ForgeHostContext,
  WorkspaceContext,
} from './types/forge';
import {
  buildDriftAnalysisRequest,
  createDefaultAnalysisConfig,
  createDefaultControlsState,
  createDefaultScopeInput,
  createIdleOperationState,
  formatUnavailableOperationMessage,
  hasMeaningfulScope,
  resolveEffectiveScope,
  resolveNextAgentMode,
  toggleIntelligenceSource,
} from './utils/ceraControlLogic';

export default function App() {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsState, setControlsState] = useState<AgentControlsState>(
    createDefaultControlsState,
  );
  const [analysisConfig, setAnalysisConfig] = useState<CeraAnalysisConfig>(
    () => createDefaultAnalysisConfig(),
  );
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [refreshingConnections, setRefreshingConnections] = useState(false);

  const [consciousSession, setConsciousSession] =
    useState<ConsciousSessionState>({
      runtimeMode: 'checking',
      workflowStage: 'initializing',
      hostContext: null,
      workspaceContext: null,
      lastError: null,
    });

  const [activeQuickAction, setActiveQuickAction] =
    useState<CeraQuickActionKey | null>(null);
  const [analysisOperation, setAnalysisOperation] = useState<
    CeraOperationState<DriftAnalysisResult>
  >(createIdleOperationState);
  const [evidenceOperation, setEvidenceOperation] = useState<
    CeraOperationState<DriftEvidenceResult>
  >(createIdleOperationState);
  const [pendingDraftOperation, setPendingDraftOperation] = useState<
    CeraOperationState<ConfluenceDocDraft>
  >(createIdleOperationState);
  const [applyUpdateOperation, setApplyUpdateOperation] = useState<
    CeraOperationState<ConfluenceUpdateResult>
  >(createIdleOperationState);

  const syncDefaultScopeFromContext = useCallback(
    (hostContext: ForgeHostContext | null, workspaceContext: WorkspaceContext | null) => {
      const derived = createDefaultScopeInput(hostContext, workspaceContext);
      if (!derived.value) {
        return;
      }
      setAnalysisConfig((prev) =>
        prev.scopeInput.value.trim() ? prev : { ...prev, scopeInput: derived },
      );
    },
    [],
  );

  const loadWorkspaceStatus = useCallback(async () => {
    setRefreshingConnections(true);
    try {
      const hostContext = await getHostContext();

      if (hostContext.mode === 'standalone') {
        setConsciousSession({
          runtimeMode: 'standalone',
          workflowStage: 'standalone',
          hostContext,
          workspaceContext: null,
          lastError: null,
        });
        syncDefaultScopeFromContext(hostContext, null);
        return;
      }

      const workspaceResult = await fetchWorkspaceContext();

      if (workspaceResult.ok) {
        setConsciousSession({
          runtimeMode: 'forge',
          workflowStage: 'ready',
          hostContext,
          workspaceContext: workspaceResult.data,
          lastError: null,
        });
        syncDefaultScopeFromContext(hostContext, workspaceResult.data);
        return;
      }

      setConsciousSession({
        runtimeMode: 'forge',
        workflowStage:
          workspaceResult.status === 'not_implemented' ? 'backend_pending' : 'error',
        hostContext,
        workspaceContext: null,
        lastError: workspaceResult.error,
      });
      syncDefaultScopeFromContext(hostContext, null);
    } finally {
      setRefreshingConnections(false);
    }
  }, [syncDefaultScopeFromContext]);

  useEffect(() => {
    let cancelled = false;

    async function initializeForgeContext() {
      const hostContext = await getHostContext();
      if (cancelled) {
        return;
      }

      if (hostContext.mode === 'standalone') {
        setConsciousSession({
          runtimeMode: 'standalone',
          workflowStage: 'standalone',
          hostContext,
          workspaceContext: null,
          lastError: null,
        });
        syncDefaultScopeFromContext(hostContext, null);
        return;
      }

      const workspaceResult = await fetchWorkspaceContext();
      if (cancelled) {
        return;
      }

      if (workspaceResult.ok) {
        setConsciousSession({
          runtimeMode: 'forge',
          workflowStage: 'ready',
          hostContext,
          workspaceContext: workspaceResult.data,
          lastError: null,
        });
        syncDefaultScopeFromContext(hostContext, workspaceResult.data);
        return;
      }

      setConsciousSession({
        runtimeMode: 'forge',
        workflowStage:
          workspaceResult.status === 'not_implemented' ? 'backend_pending' : 'error',
        hostContext,
        workspaceContext: null,
        lastError: workspaceResult.error,
      });
      syncDefaultScopeFromContext(hostContext, null);
    }

    void initializeForgeContext();

    return () => {
      cancelled = true;
    };
  }, [syncDefaultScopeFromContext]);

  const handleRunDriftCheck = useCallback(async () => {
    setActiveQuickAction('drift');

    if (analysisConfig.selectedSources.length === 0) {
      setAnalysisOperation({
        status: 'error',
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Select at least one intelligence source before running a documentation check.',
        },
        statusMessage:
          'Select at least one intelligence source before running a documentation check.',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const effectiveScope = resolveEffectiveScope(
      analysisConfig,
      consciousSession.workspaceContext,
      consciousSession.hostContext,
    );

    if (!hasMeaningfulScope(effectiveScope)) {
      setAnalysisOperation({
        status: 'error',
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Enter a meaningful analysis scope (Jira project/issue, Confluence space/page, Bitbucket repo, or JSM incident) or open Conscious within an active Jira context.',
        },
        statusMessage:
          'A meaningful analysis scope is required before running a check. Enter a Jira project/issue, Confluence space/page, Bitbucket repo, or JSM incident in Analysis Scope above.',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setControlsState((prev) => ({ ...prev, mode: 'analyzing' }));
    setAnalysisOperation((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
      statusMessage: null,
    }));

    const request = buildDriftAnalysisRequest(
      analysisConfig,
      consciousSession.workspaceContext,
      consciousSession.hostContext,
    );
    const result = await runDriftAnalysis(request);

    if (result.ok) {
      setAnalysisOperation({
        status: 'success',
        data: result.data,
        error: null,
        statusMessage: null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const message = formatUnavailableOperationMessage(
      'Documentation drift check',
      result.status,
      result.error,
      consciousSession,
    );

    setAnalysisOperation({
      status:
        result.status === 'standalone' || result.status === 'not_implemented'
          ? 'unavailable'
          : 'error',
      data: null,
      error: result.error,
      statusMessage: message,
      updatedAt: new Date().toISOString(),
    });
  }, [analysisConfig, consciousSession]);

  const handleRunDocumentationCheck = useCallback(() => {
    setControlsOpen(true);
    setControlsState((prev) =>
      prev.mode === 'sleep' ? { ...prev, mode: 'standby' } : prev,
    );
    void handleRunDriftCheck();
  }, [handleRunDriftCheck]);

  const handleOpenWorkspaceConnections = useCallback(() => {
    setConnectionsModalOpen(true);
    if (consciousSession.runtimeMode === 'forge' && !consciousSession.workspaceContext) {
      void loadWorkspaceStatus();
    }
  }, [consciousSession.runtimeMode, consciousSession.workspaceContext, loadWorkspaceStatus]);

  const handleReviewPendingChanges = useCallback(async () => {
    setActiveQuickAction('pending');
    setApplyUpdateOperation(createIdleOperationState());

    const firstFindingWithPage = analysisOperation.data?.findings.find(
      (finding) => Boolean(finding.affectedPageId),
    );

    if (
      analysisOperation.data &&
      firstFindingWithPage?.affectedPageId
    ) {
      setPendingDraftOperation((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        statusMessage: null,
      }));

      const draftResult = await generateDocDraft({
        analysisId: analysisOperation.data.analysisId,
        findingId: firstFindingWithPage.id,
        pageId: firstFindingWithPage.affectedPageId,
      });

      if (draftResult.ok) {
        setPendingDraftOperation({
          status: 'success',
          data: draftResult.data,
          error: null,
          statusMessage: null,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      setPendingDraftOperation({
        status:
          draftResult.status === 'standalone' ||
          draftResult.status === 'not_implemented'
            ? 'unavailable'
            : 'error',
        data: null,
        error: draftResult.error,
        statusMessage: formatUnavailableOperationMessage(
          'Pending Confluence changes',
          draftResult.status,
          draftResult.error,
          consciousSession,
        ),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setPendingDraftOperation((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
      statusMessage: null,
    }));

    const workspaceCheck = await fetchWorkspaceContext();
    if (workspaceCheck.ok) {
      setPendingDraftOperation({
        status: 'unavailable',
        data: null,
        error: null,
        statusMessage:
          'No pending Confluence drafts yet. Run a drift check first; every generated update requires explicit human approval.',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setPendingDraftOperation({
      status:
        workspaceCheck.status === 'standalone' ||
        workspaceCheck.status === 'not_implemented'
          ? 'unavailable'
          : 'error',
      data: null,
      error: workspaceCheck.error,
      statusMessage: formatUnavailableOperationMessage(
        'Pending Confluence changes',
        workspaceCheck.status,
        workspaceCheck.error,
        consciousSession,
      ),
      updatedAt: new Date().toISOString(),
    });
  }, [analysisOperation.data, consciousSession]);

  const handleLoadRecentFindings = useCallback(async () => {
    setActiveQuickAction('findings');

    if (analysisOperation.data) {
      setEvidenceOperation((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        statusMessage: null,
      }));

      const evidenceResult = await fetchDriftEvidence({
        analysisId: analysisOperation.data.analysisId,
      });

      if (evidenceResult.ok) {
        setEvidenceOperation({
          status: 'success',
          data: evidenceResult.data,
          error: null,
          statusMessage: null,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      setEvidenceOperation({
        status:
          evidenceResult.status === 'standalone' ||
          evidenceResult.status === 'not_implemented'
            ? 'unavailable'
            : 'error',
        data: null,
        error: evidenceResult.error,
        statusMessage: formatUnavailableOperationMessage(
          'Recent findings',
          evidenceResult.status,
          evidenceResult.error,
          consciousSession,
        ),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setEvidenceOperation((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
      statusMessage: null,
    }));

    const workspaceCheck = await fetchWorkspaceContext();
    if (workspaceCheck.ok) {
      setEvidenceOperation({
        status: 'unavailable',
        data: null,
        error: null,
        statusMessage:
          'No drift checks have completed in this session yet. Use Run Drift Check to query connected Atlassian sources.',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setEvidenceOperation({
      status:
        workspaceCheck.status === 'standalone' ||
        workspaceCheck.status === 'not_implemented'
          ? 'unavailable'
          : 'error',
      data: null,
      error: workspaceCheck.error,
      statusMessage: formatUnavailableOperationMessage(
        'Recent findings',
        workspaceCheck.status,
        workspaceCheck.error,
        consciousSession,
      ),
      updatedAt: new Date().toISOString(),
    });
  }, [analysisOperation.data, consciousSession]);

  const handleApprovePendingDraft = useCallback(
    async (draft: ConfluenceDocDraft) => {
      setApplyUpdateOperation((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        statusMessage: 'Submitting explicit approval...',
      }));

      const result = await approveAndApplyConfluenceUpdate({
        approved: true,
        draftId: draft.draftId,
        pageId: draft.pageId,
        expectedVersion: draft.baseVersion,
        confirmedByAccountId: consciousSession.hostContext?.accountId,
        confirmedAt: new Date().toISOString(),
      });

      if (result.ok) {
        setApplyUpdateOperation({
          status: 'success',
          data: result.data,
          error: null,
          statusMessage: `Confluence page ${result.data.pageId} updated.`,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      setApplyUpdateOperation({
        status:
          result.status === 'standalone' || result.status === 'not_implemented'
            ? 'unavailable'
            : 'error',
        data: null,
        error: result.error,
        statusMessage: formatUnavailableOperationMessage(
          'Confluence update approval',
          result.status,
          result.error,
          consciousSession,
        ),
        updatedAt: new Date().toISOString(),
      });
    },
    [consciousSession],
  );

  const handleSelectMode = useCallback(
    (requestedMode: AgentMode) => {
      const nextMode = resolveNextAgentMode(controlsState.mode, requestedMode);
      setControlsState((prev) => ({ ...prev, mode: nextMode }));

      if (nextMode === 'analyzing') {
        void handleRunDriftCheck();
      }
    },
    [controlsState.mode, handleRunDriftCheck],
  );

  const handleAgentWake = useCallback(() => {
    setControlsState((prev) =>
      prev.mode === 'sleep' ? { ...prev, mode: 'standby' } : prev,
    );
  }, []);

  const handleToggleSource = useCallback((sourceId: IntelligenceSourceId) => {
    setAnalysisConfig((prev) => ({
      ...prev,
      selectedSources: toggleIntelligenceSource(prev.selectedSources, sourceId),
    }));
  }, []);

  const handleChangeDepth = useCallback((depth: AnalysisDepth) => {
    setAnalysisConfig((prev) => ({ ...prev, depth }));
  }, []);

  const handleChangeScopeInput = useCallback((scopeInput: CeraScopeInput) => {
    setAnalysisConfig((prev) => ({ ...prev, scopeInput }));
  }, []);

  const handleToggleCursorAwareness = useCallback(() => {
    setControlsState((prev) => ({ ...prev, trackCursor: !prev.trackCursor }));
  }, []);

  const handleChangeMotion = useCallback((motion: AgentMotionMode) => {
    setControlsState((prev) => ({ ...prev, motion }));
  }, []);

  const handleResetCera = useCallback(() => {
    setControlsState(createDefaultControlsState());
    setAnalysisConfig(
      createDefaultAnalysisConfig(
        consciousSession.hostContext,
        consciousSession.workspaceContext,
      ),
    );
    setActiveQuickAction(null);
    setAnalysisOperation(createIdleOperationState());
    setEvidenceOperation(createIdleOperationState());
    setPendingDraftOperation(createIdleOperationState());
    setApplyUpdateOperation(createIdleOperationState());
    setResetCameraSignal((n) => n + 1);
  }, [consciousSession.hostContext, consciousSession.workspaceContext]);

  return (
    <div className="min-h-screen bg-[#04070E] text-[#E6EEF8]">
      <Header onOpenWorkspaceConnections={handleOpenWorkspaceConnections} />

      <main>
        <HeroSection
          controlsOpen={controlsOpen}
          controlsState={controlsState}
          analysisConfig={analysisConfig}
          session={consciousSession}
          resetCameraSignal={resetCameraSignal}
          activeQuickAction={activeQuickAction}
          analysisOperation={analysisOperation}
          evidenceOperation={evidenceOperation}
          pendingDraftOperation={pendingDraftOperation}
          applyUpdateOperation={applyUpdateOperation}
          onToggleControls={() => setControlsOpen((prev) => !prev)}
          onCloseControls={() => setControlsOpen(false)}
          onSelectMode={handleSelectMode}
          onToggleSource={handleToggleSource}
          onChangeDepth={handleChangeDepth}
          onChangeScopeInput={handleChangeScopeInput}
          onToggleCursorAwareness={handleToggleCursorAwareness}
          onChangeMotion={handleChangeMotion}
          onRunDocumentationCheck={handleRunDocumentationCheck}
          onRunDriftCheck={() => {
            void handleRunDriftCheck();
          }}
          onReviewPendingChanges={() => {
            void handleReviewPendingChanges();
          }}
          onLoadRecentFindings={() => {
            void handleLoadRecentFindings();
          }}
          onApprovePendingDraft={(draft) => {
            void handleApprovePendingDraft(draft);
          }}
          onAgentWake={handleAgentWake}
          onResetCera={handleResetCera}
        />
      </main>

      <WorkspaceConnectionsModal
        open={connectionsModalOpen}
        session={consciousSession}
        refreshing={refreshingConnections}
        onRefresh={() => {
          void loadWorkspaceStatus();
        }}
        onClose={() => setConnectionsModalOpen(false)}
      />
    </div>
  );
}
