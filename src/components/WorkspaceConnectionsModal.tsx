import { RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import type { IntelligenceSourceId } from '../types/agent';
import type {
  ConsciousSessionState,
  SourceConnectionStatus,
  WorkspaceContext,
} from '../types/forge';
import {
  INTELLIGENCE_SOURCES,
  getSourceConnectionStatus,
} from '../utils/ceraControlLogic';

interface WorkspaceConnectionsModalProps {
  open: boolean;
  session: ConsciousSessionState;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

function getSourceDetail(
  sourceId: IntelligenceSourceId,
  workspace: WorkspaceContext | null,
): string | null {
  if (!workspace) {
    return null;
  }

  switch (sourceId) {
    case 'jira':
      return workspace.projectKey ? `Active project: ${workspace.projectKey}` : null;
    case 'confluence':
      return workspace.spaceKey ? `Active space: ${workspace.spaceKey}` : null;
    case 'bitbucket':
      return workspace.repositorySlug
        ? `Repository: ${workspace.repositorySlug}`
        : null;
    case 'jsm':
      return workspace.serviceId ? `Service: ${workspace.serviceId}` : null;
    case 'teamwork-graph':
      return null;
  }
}

function getConnectionStatusCopy(
  status: SourceConnectionStatus,
  sourceLabel: string,
  session: ConsciousSessionState,
): {
  label: string;
  explanation: string;
  toneClass: string;
} {
  if (status === 'connected') {
    return {
      label: 'Connected',
      explanation: `${sourceLabel} is verified and accessible in the active Forge workspace.`,
      toneClass: 'text-sky-300',
    };
  }

  if (status === 'not_connected') {
    return {
      label: 'Not connected',
      explanation: `${sourceLabel} is unavailable or missing required Atlassian app permissions/scopes on this site.`,
      toneClass: 'text-amber-300/90',
    };
  }

  if (session.runtimeMode === 'standalone') {
    return {
      label: 'Unavailable',
      explanation:
        'Forge host bridge is absent in standalone preview; live connections and permissions cannot be verified.',
      toneClass: 'text-slate-400',
    };
  }

  if (session.workflowStage === 'backend_pending') {
    return {
      label: 'Unavailable',
      explanation:
        'The getWorkspaceContext Forge resolver is pending backend implementation.',
      toneClass: 'text-slate-400',
    };
  }

  return {
    label: 'Unverified',
    explanation:
      session.lastError?.causeMessage ??
      session.lastError?.message ??
      'Workspace connection status could not be verified.',
    toneClass: 'text-amber-300/90',
  };
}

export function WorkspaceConnectionsModal({
  open,
  session,
  refreshing,
  onRefresh,
  onClose,
}: WorkspaceConnectionsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const connectedCount = INTELLIGENCE_SOURCES.filter(
    (source) =>
      getSourceConnectionStatus(source.id, session.workspaceContext) ===
      'connected',
  ).length;

  const runtimeLine = (() => {
    if (session.runtimeMode === 'checking' || refreshing) {
      return 'Checking Atlassian Forge workspace context...';
    }
    if (session.runtimeMode === 'standalone') {
      return 'Standalone local preview · Forge host not detected';
    }
    const product =
      session.hostContext?.product && session.hostContext.product !== 'unknown'
        ? session.hostContext.product.toUpperCase()
        : 'Forge';
    const site = session.hostContext?.siteUrl
      ? ` · ${session.hostContext.siteUrl}`
      : '';
    return `${product} host${site}`;
  })();

  const bannerMessage = (() => {
    if (refreshing || session.runtimeMode === 'checking') {
      return 'Querying getWorkspaceContext via @forge/bridge...';
    }
    if (session.runtimeMode === 'standalone') {
      return 'Running outside an Atlassian Forge host. Integration connections and Atlassian OAuth/app scopes are unverified until deployed in Forge.';
    }
    if (session.workflowStage === 'ready' && session.workspaceContext) {
      return `Backend reported ${connectedCount} of ${INTELLIGENCE_SOURCES.length} integrations connected for this workspace.`;
    }
    if (session.workflowStage === 'backend_pending') {
      return 'Forge backend integration pending: the getWorkspaceContext resolver is not implemented yet, so product connections and permissions cannot be verified.';
    }
    return (
      session.lastError?.causeMessage ??
      session.lastError?.message ??
      'Workspace connections could not be verified due to missing permissions or a resolver error.'
    );
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-connections-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-sky-400/22 bg-[#081022] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="workspace-connections-title"
              className="font-display text-lg font-semibold text-white"
            >
              Workspace Connections
            </h2>
            <p className="mt-1 text-xs text-slate-400 truncate">{runtimeLine}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace connections"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Backend-reported availability summary */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#04070E]/85 px-3.5 py-3 text-xs leading-relaxed text-slate-300">
          <ShieldAlert
            className="h-4 w-4 mt-0.5 shrink-0 text-sky-400"
            aria-hidden="true"
          />
          <p>{bannerMessage}</p>
        </div>

        {/* Integration status rows */}
        <div className="mt-4 divide-y divide-white/8 rounded-xl border border-white/10 bg-[#04070E]/75">
          {INTELLIGENCE_SOURCES.map((source) => {
            const status = getSourceConnectionStatus(
              source.id,
              session.workspaceContext,
            );
            const copy = getConnectionStatusCopy(status, source.label, session);
            const detail = getSourceDetail(source.id, session.workspaceContext);

            return (
              <div
                key={source.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {source.label}
                    </span>
                    {detail && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {detail}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {copy.explanation}
                  </p>
                </div>

                <span
                  className={`text-xs font-medium whitespace-nowrap shrink-0 ${copy.toneClass}`}
                >
                  {copy.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-[#04070E] px-3.5 py-2 text-xs font-medium text-sky-200 hover:border-sky-400/50 hover:text-white transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
