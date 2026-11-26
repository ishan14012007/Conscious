import {
  Check,
  Eye,
  EyeOff,
  FileSearch,
  GitPullRequestDraft,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  AgentControlsState,
  AgentMode,
  AgentMotionMode,
  AnalysisDepth,
  CeraAnalysisConfig,
  CeraScopeInput,
  DriftScopeKind,
  IntelligenceSourceId,
} from '../types/agent';
import type {
  CeraOperationState,
  CeraQuickActionKey,
  ConfluenceDocDraft,
  ConfluenceUpdateResult,
  ConsciousSessionState,
  DriftAnalysisResult,
  DriftEvidenceResult,
  SourceConnectionStatus,
} from '../types/forge';
import {
  ANALYSIS_DEPTH_OPTIONS,
  DRIFT_SCOPE_OPTIONS,
  INTELLIGENCE_SOURCES,
  getSourceConnectionStatus,
  hasMeaningfulScope,
  resolveEffectiveScope,
} from '../utils/ceraControlLogic';

interface CeraControlCentreProps {
  controlsState: AgentControlsState;
  analysisConfig: CeraAnalysisConfig;
  session: ConsciousSessionState;
  activeQuickAction: CeraQuickActionKey | null;
  analysisOperation: CeraOperationState<DriftAnalysisResult>;
  evidenceOperation: CeraOperationState<DriftEvidenceResult>;
  pendingDraftOperation: CeraOperationState<ConfluenceDocDraft>;
  applyUpdateOperation: CeraOperationState<ConfluenceUpdateResult>;
  onSelectMode: (mode: AgentMode) => void;
  onToggleSource: (sourceId: IntelligenceSourceId) => void;
  onChangeDepth: (depth: AnalysisDepth) => void;
  onChangeScopeInput: (scopeInput: CeraScopeInput) => void;
  onToggleCursorAwareness: () => void;
  onChangeMotion: (motion: AgentMotionMode) => void;
  onRunDriftCheck: () => void;
  onReviewPendingChanges: () => void;
  onLoadRecentFindings: () => void;
  onApprovePendingDraft?: (draft: ConfluenceDocDraft) => void;
  onReset: () => void;
  onClose: () => void;
}

const AGENT_MODES: ReadonlyArray<{ id: AgentMode; label: string }> = [
  { id: 'standby', label: 'Standby' },
  { id: 'focused', label: 'Focus' },
  { id: 'analyzing', label: 'Analyze' },
  { id: 'sleep', label: 'Sleep' },
];

const MOTION_OPTIONS: ReadonlyArray<{ id: AgentMotionMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'reduced', label: 'Reduced' },
];

function formatRuntimeSummary(session: ConsciousSessionState): string {
  if (session.runtimeMode === 'checking') {
    return 'Detecting runtime host';
  }
  if (session.runtimeMode === 'standalone') {
    return 'Standalone preview · Forge host not detected';
  }
  const productLabel =
    session.hostContext?.product && session.hostContext.product !== 'unknown'
      ? session.hostContext.product.toUpperCase()
      : 'Forge host';
  if (session.workflowStage === 'ready') {
    return `${productLabel} · Workspace connected`;
  }
  if (session.workflowStage === 'backend_pending') {
    return `${productLabel} · Backend resolvers pending`;
  }
  return `${productLabel} · Backend unavailable`;
}

function formatConnectionLabel(
  status: SourceConnectionStatus,
  session: ConsciousSessionState,
): string {
  if (status === 'connected') {
    return 'Connected';
  }
  if (status === 'not_connected') {
    return 'Not connected';
  }
  return session.runtimeMode === 'standalone' ? 'Requires Forge' : 'Unverified';
}

function formatFocusTarget(
  analysisConfig: CeraAnalysisConfig,
  session: ConsciousSessionState,
): string {
  const workspace = session.workspaceContext;
  if (workspace?.projectKey) {
    return `project ${workspace.projectKey}`;
  }
  if (workspace?.spaceKey) {
    return `space ${workspace.spaceKey}`;
  }
  if (analysisConfig.selectedSources.length === 0) {
    return 'workspace scope (no sources selected)';
  }
  if (analysisConfig.selectedSources.length === 1) {
    const match = INTELLIGENCE_SOURCES.find(
      (s) => s.id === analysisConfig.selectedSources[0],
    );
    return match ? match.label : 'selected source';
  }
  return `${analysisConfig.selectedSources.length} selected sources`;
}

export function CeraControlCentre({
  controlsState,
  analysisConfig,
  session,
  activeQuickAction,
  analysisOperation,
  evidenceOperation,
  pendingDraftOperation,
  applyUpdateOperation,
  onSelectMode,
  onToggleSource,
  onChangeDepth,
  onChangeScopeInput,
  onToggleCursorAwareness,
  onChangeMotion,
  onRunDriftCheck,
  onReviewPendingChanges,
  onLoadRecentFindings,
  onApprovePendingDraft,
  onReset,
  onClose,
}: CeraControlCentreProps) {
  const isSleeping = controlsState.mode === 'sleep';
  const isReducedMotion = controlsState.motion === 'reduced';
  const verifiedConnectedCount = INTELLIGENCE_SOURCES.filter(
    (source) =>
      getSourceConnectionStatus(source.id, session.workspaceContext) === 'connected',
  ).length;
  const effectiveScope = resolveEffectiveScope(
    analysisConfig,
    session.workspaceContext,
    session.hostContext,
  );
  const scopeReady = hasMeaningfulScope(effectiveScope);
  const activeJiraBadge =
    session.hostContext?.issueKey ??
    session.workspaceContext?.projectKey ??
    session.hostContext?.projectKey ??
    null;
  const selectedScopeOption =
    DRIFT_SCOPE_OPTIONS.find((opt) => opt.id === analysisConfig.scopeInput.kind) ??
    DRIFT_SCOPE_OPTIONS[0];

  const modeSummary = (() => {
    switch (controlsState.mode) {
      case 'standby':
        return 'Standby · Ready for drift checks and workspace tasks.';
      case 'focused':
        return `Focus · Distractions reduced — concentrating on ${formatFocusTarget(
          analysisConfig,
          session,
        )}.`;
      case 'analyzing': {
        if (analysisOperation.status === 'loading') {
          return 'Analyze · Requesting drift analysis from Forge backend.';
        }
        if (analysisOperation.status === 'success') {
          return 'Analyze · Visual scan active · Last drift check returned results.';
        }
        if (analysisOperation.status === 'unavailable') {
          return 'Analyze · Visual scan active · Backend resolver unavailable.';
        }
        if (analysisOperation.status === 'error') {
          return 'Analyze · Visual scan active · Analysis request did not complete.';
        }
        return 'Analyze · Visual scan active · No completed analysis yet.';
      }
      case 'sleep':
        return 'Sleep · Nonessential motion & gaze paused · Settings preserved. Select Sleep again to wake.';
    }
  })();

  return (
    <motion.aside
      key="cera-control-centre"
      aria-label="Cera Control Centre"
      initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
      transition={{ duration: isReducedMotion ? 0.1 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto absolute inset-x-3 bottom-3 max-h-[68vh] md:inset-x-auto md:bottom-auto md:right-6 lg:right-10 md:top-1/2 md:-translate-y-1/2 md:w-[356px] lg:w-[400px] xl:w-[420px] md:max-h-[calc(100%-32px)] z-20 flex flex-col overflow-y-auto rounded-xl border border-sky-400/18 bg-[#04070E]/92 backdrop-blur-md text-[#E6EEF8] shadow-[0_18px_48px_rgba(2,6,18,0.85)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-tight text-white">
            Cera Control Centre
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400 truncate">
            {formatRuntimeSummary(session)}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset Cera settings"
            className="inline-flex min-h-[32px] items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close control centre"
            className="inline-flex min-h-[32px] items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-300 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* 1. Agent Modes */}
      <div className="border-t border-white/8 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-medium text-sky-400/90">
            Agent Mode
          </span>
          {controlsState.mode === 'focused' && (
            <span className="text-[11px] text-sky-300/90">
              Focused state active
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Cera mode"
          className="grid grid-cols-4 gap-1 rounded-lg bg-[#0A1120] p-1 border border-white/6"
        >
          {AGENT_MODES.map((m) => {
            const active = controlsState.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectMode(m.id)}
                className={`min-h-[36px] md:min-h-[32px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-300/90">
          {modeSummary}
        </p>
      </div>

      {/* 2. Intelligence Sources */}
      <div className="border-t border-white/8 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium text-sky-400/90">
            Intelligence Sources
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {analysisConfig.selectedSources.length} selected · {verifiedConnectedCount} connected
          </span>
        </div>
        <p className="mt-0.5 mb-2 text-[11px] text-slate-500">
          Select sources to include in analysis requests. Connection state reflects live Forge workspace status.
        </p>

        <div
          role="group"
          aria-label="Intelligence sources"
          className="divide-y divide-white/6 rounded-lg border border-white/8 bg-[#070C17]/75"
        >
          {INTELLIGENCE_SOURCES.map((source) => {
            const selected = analysisConfig.selectedSources.includes(source.id);
            const connectionStatus = getSourceConnectionStatus(
              source.id,
              session.workspaceContext,
            );
            const connectionLabel = formatConnectionLabel(connectionStatus, session);

            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleSource(source.id)}
                className="flex w-full min-h-[40px] md:min-h-[34px] items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors hover:bg-white/4 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-400"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      selected
                        ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                        : 'border-slate-600 bg-transparent text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${
                      selected ? 'text-slate-100' : 'text-slate-400'
                    }`}
                  >
                    {source.label}
                  </span>
                </span>

                <span
                  className={`text-[11px] whitespace-nowrap shrink-0 ${
                    connectionStatus === 'connected'
                      ? 'text-sky-300'
                      : 'text-slate-500'
                  }`}
                >
                  {connectionLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Analysis Configuration */}
      <div className="border-t border-white/8 px-4 py-3 space-y-3">
        <span className="block text-[11px] font-medium text-sky-400/90">
          Analysis Configuration
        </span>

        {/* Analysis Scope */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="cera-scope-value"
              className="text-xs text-slate-300"
            >
              Analysis Scope
            </label>
            <span
              className={`text-[11px] truncate ${
                activeJiraBadge
                  ? 'text-sky-300'
                  : scopeReady
                    ? 'text-slate-400'
                    : 'text-amber-300/90'
              }`}
            >
              {activeJiraBadge
                ? `Active Jira: ${activeJiraBadge}`
                : scopeReady
                  ? 'Scope configured'
                  : 'Scope required'}
            </span>
          </div>
          <div className="grid grid-cols-[126px_1fr] gap-2">
            <select
              aria-label="Analysis scope type"
              value={analysisConfig.scopeInput.kind}
              onChange={(event) =>
                onChangeScopeInput({
                  ...analysisConfig.scopeInput,
                  kind: event.target.value as DriftScopeKind,
                })
              }
              className="min-h-[36px] md:min-h-[32px] rounded-lg border border-white/10 bg-[#0A1120] px-2 py-1 text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
            >
              {DRIFT_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              id="cera-scope-value"
              type="text"
              value={analysisConfig.scopeInput.value}
              onChange={(event) =>
                onChangeScopeInput({
                  ...analysisConfig.scopeInput,
                  value: event.target.value,
                })
              }
              placeholder={selectedScopeOption.placeholder}
              className="min-h-[36px] md:min-h-[32px] rounded-lg border border-white/10 bg-[#04070E] px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Analysis Depth */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-300">Analysis Depth</span>
            <span className="text-[11px] text-slate-400 capitalize">
              {analysisConfig.depth}
            </span>
          </div>
          <div
            role="group"
            aria-label="Analysis depth"
            className="grid grid-cols-3 gap-1 rounded-lg bg-[#0A1120] p-1 border border-white/6"
          >
            {ANALYSIS_DEPTH_OPTIONS.map((option) => {
              const active = analysisConfig.depth === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeDepth(option.id)}
                  className={`min-h-[36px] md:min-h-[30px] rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    active
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cursor Awareness & Motion */}
        <div className="grid grid-cols-2 gap-3 pt-0.5">
          <div>
            <span className="block text-[11px] text-slate-400 mb-1.5">
              Cursor Awareness
            </span>
            <button
              type="button"
              aria-pressed={controlsState.trackCursor}
              onClick={onToggleCursorAwareness}
              className={`flex w-full min-h-[38px] md:min-h-[34px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                controlsState.trackCursor
                  ? 'border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15'
                  : 'border-white/8 bg-[#0A1120] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {controlsState.trackCursor ? (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{controlsState.trackCursor ? 'On' : 'Off'}</span>
              </span>
              {isSleeping && controlsState.trackCursor && (
                <span className="text-[10px] text-slate-400">Paused</span>
              )}
            </button>
          </div>

          <div>
            <span className="block text-[11px] text-slate-400 mb-1.5">
              Motion
            </span>
            <div
              role="group"
              aria-label="Motion preference"
              className="grid grid-cols-2 gap-1 rounded-lg bg-[#0A1120] p-1 border border-white/6"
            >
              {MOTION_OPTIONS.map((opt) => {
                const active = controlsState.motion === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeMotion(opt.id)}
                    className={`min-h-[30px] md:min-h-[26px] rounded px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                      active
                        ? 'bg-sky-500/20 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Documentation Approval Policy (invariant / non-removable) */}
        <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed text-slate-300/90">
          <ShieldCheck
            className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-400"
            aria-hidden="true"
          />
          <p>
            <span className="font-medium text-slate-200">
              Documentation Approval:
            </span>{' '}
            Every Confluence update requires explicit human approval before
            execution.
          </p>
        </div>
      </div>

      {/* 4. Quick Actions */}
      <div className="border-t border-white/8 px-4 py-3">
        <span className="block text-[11px] font-medium text-sky-400/90 mb-2">
          Quick Actions
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRunDriftCheck}
            disabled={analysisOperation.status === 'loading'}
            className={`inline-flex min-h-[38px] md:min-h-[34px] flex-1 basis-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-400 ${
              activeQuickAction === 'drift'
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#1D4ED8]/85 text-white hover:bg-[#1D4ED8]'
            }`}
          >
            {analysisOperation.status === 'loading' ? (
              <Loader2
                className={`h-3.5 w-3.5 shrink-0 ${isReducedMotion ? '' : 'animate-spin'}`}
                aria-hidden="true"
              />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>Run Drift Check</span>
          </button>

          <button
            type="button"
            onClick={onReviewPendingChanges}
            className={`inline-flex min-h-[38px] md:min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
              activeQuickAction === 'pending'
                ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                : 'border-white/10 bg-[#0A1120] text-slate-200 hover:border-sky-400/30 hover:text-white'
            }`}
          >
            <GitPullRequestDraft
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>Review Pending Changes</span>
          </button>

          <button
            type="button"
            onClick={onLoadRecentFindings}
            className={`inline-flex min-h-[38px] md:min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
              activeQuickAction === 'findings'
                ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                : 'border-white/10 bg-[#0A1120] text-slate-200 hover:border-sky-400/30 hover:text-white'
            }`}
          >
            <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Recent Findings</span>
          </button>
        </div>

        {/* Real Operation Feedback Area */}
        {activeQuickAction !== null && (
          <div
            aria-live="polite"
            className="mt-3 border-t border-white/8 pt-2.5 text-xs"
          >
            {activeQuickAction === 'drift' && (
              <DriftOperationView operation={analysisOperation} />
            )}
            {activeQuickAction === 'pending' && (
              <PendingChangesView
                draftOperation={pendingDraftOperation}
                applyOperation={applyUpdateOperation}
                onApprove={onApprovePendingDraft}
              />
            )}
            {activeQuickAction === 'findings' && (
              <RecentFindingsView
                analysisOperation={analysisOperation}
                evidenceOperation={evidenceOperation}
              />
            )}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function DriftOperationView({
  operation,
}: {
  operation: CeraOperationState<DriftAnalysisResult>;
}) {
  if (operation.status === 'loading') {
    return (
      <p className="text-slate-300">
        Checking documentation drift across selected sources...
      </p>
    );
  }

  if (operation.status === 'success' && operation.data) {
    return (
      <div className="space-y-1.5">
        <p className="font-medium text-sky-300">
          Drift check completed · {operation.data.findings.length} finding(s)
        </p>
        {operation.data.findings.length === 0 ? (
          <p className="text-slate-400">
            No drift findings reported for the selected workspace scope.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {operation.data.findings.map((finding) => (
              <li
                key={finding.id}
                className="border-t border-white/6 pt-1.5 text-slate-300"
              >
                <span className="font-medium text-white">{finding.title}</span>
                <span className="text-slate-400"> · {finding.severity}</span>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {finding.summary}
                </p>
                {(finding.affectedPageId || finding.sourceRefs.length > 0) && (
                  <p className="mt-0.5 text-[10px] font-mono text-slate-500">
                    {finding.affectedPageId
                      ? `Page ${finding.affectedPageId}`
                      : ''}
                    {finding.affectedPageId && finding.sourceRefs.length > 0
                      ? ' · '
                      : ''}
                    {finding.sourceRefs.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (operation.status === 'unavailable' || operation.status === 'error') {
    return (
      <div className="space-y-1">
        <p className="font-medium text-sky-300">
          {operation.status === 'unavailable'
            ? 'Backend integration required'
            : 'Drift check unavailable'}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {operation.statusMessage ??
            operation.error?.message ??
            'Unable to run drift analysis without a backend resolver.'}
        </p>
      </div>
    );
  }

  return (
    <p className="text-slate-400">
      Select sources and run a drift check when connected to a Forge backend.
    </p>
  );
}

function PendingChangesView({
  draftOperation,
  applyOperation,
  onApprove,
}: {
  draftOperation: CeraOperationState<ConfluenceDocDraft>;
  applyOperation: CeraOperationState<ConfluenceUpdateResult>;
  onApprove?: (draft: ConfluenceDocDraft) => void;
}) {
  if (draftOperation.status === 'loading') {
    return <p className="text-slate-300">Checking pending Confluence drafts...</p>;
  }

  if (draftOperation.status === 'success' && draftOperation.data) {
    const draft = draftOperation.data;
    return (
      <div className="space-y-2">
        <p className="font-medium text-white">
          Draft ready for page {draft.pageTitle ?? draft.pageId}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {draft.summaryOfChanges}
        </p>
        {applyOperation.statusMessage && (
          <p className="text-[11px] text-sky-300">
            {applyOperation.statusMessage}
          </p>
        )}
        {onApprove && (
          <button
            type="button"
            onClick={() => onApprove(draft)}
            disabled={applyOperation.status === 'loading'}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Approve &amp; Apply Confluence Update</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="font-medium text-sky-300">
        Pending changes unavailable
      </p>
      <p className="text-[11px] leading-relaxed text-slate-300">
        {draftOperation.statusMessage ??
          'Reviewing and approving Confluence drafts requires Forge backend integration (generateDocDraft / approveAndApplyConfluenceUpdate).'}
      </p>
    </div>
  );
}

function RecentFindingsView({
  analysisOperation,
  evidenceOperation,
}: {
  analysisOperation: CeraOperationState<DriftAnalysisResult>;
  evidenceOperation: CeraOperationState<DriftEvidenceResult>;
}) {
  if (evidenceOperation.status === 'loading') {
    return <p className="text-slate-300">Loading findings and evidence...</p>;
  }

  if (evidenceOperation.status === 'success' && evidenceOperation.data) {
    return (
      <div className="space-y-1.5">
        <p className="font-medium text-sky-300">
          Evidence items · {evidenceOperation.data.items.length}
        </p>
        {evidenceOperation.data.items.length === 0 ? (
          <p className="text-slate-400">
            No evidence records returned for this analysis.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {evidenceOperation.data.items.map((item) => (
              <li
                key={item.id}
                className="border-t border-white/6 pt-1.5 text-slate-300"
              >
                <span className="font-medium text-white">
                  {item.sourceProduct.toUpperCase()} · {item.sourceRef}
                </span>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {item.excerpt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (analysisOperation.status === 'success' && analysisOperation.data) {
    return <DriftOperationView operation={analysisOperation} />;
  }

  return (
    <div className="space-y-1">
      <p className="font-medium text-sky-300">
        Recent findings unavailable
      </p>
      <p className="text-[11px] leading-relaxed text-slate-300">
        {evidenceOperation.statusMessage ??
          'Recent drift findings require Forge backend resolvers (runDriftAnalysis / fetchDriftEvidence).'}
      </p>
    </div>
  );
}
