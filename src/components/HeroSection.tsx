import { AnimatePresence, MotionConfig } from 'motion/react';
import { useState } from 'react';
import {
  AgentControlsState,
  AgentMode,
  AgentMotionMode,
  AnalysisDepth,
  CeraAnalysisConfig,
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
} from '../types/forge';
import { AgentStage3D } from './AgentStage3D';
import { CeraControlCentre } from './CeraControlCentre';

interface HeroSectionProps {
  controlsState: AgentControlsState;
  analysisConfig: CeraAnalysisConfig;
  session: ConsciousSessionState;
  resetCameraSignal: number;
  activeQuickAction: CeraQuickActionKey | null;
  analysisOperation: CeraOperationState<DriftAnalysisResult>;
  evidenceOperation: CeraOperationState<DriftEvidenceResult>;
  pendingDraftOperation: CeraOperationState<ConfluenceDocDraft>;
  applyUpdateOperation: CeraOperationState<ConfluenceUpdateResult>;
  onSelectMode: (mode: AgentMode) => void;
  onToggleSource: (sourceId: IntelligenceSourceId) => void;
  onChangeDepth: (depth: AnalysisDepth) => void;
  onToggleCursorAwareness: () => void;
  onChangeMotion: (motion: AgentMotionMode) => void;
  onRunDriftCheck: () => void;
  onReviewPendingChanges: () => void;
  onLoadRecentFindings: () => void;
  onApprovePendingDraft: (draft: ConfluenceDocDraft) => void;
  onAgentWake: () => void;
  onResetCera: () => void;
  onOpenAccessModal: () => void;
}

export function HeroSection({
  controlsState,
  analysisConfig,
  session,
  resetCameraSignal,
  activeQuickAction,
  analysisOperation,
  evidenceOperation,
  pendingDraftOperation,
  applyUpdateOperation,
  onSelectMode,
  onToggleSource,
  onChangeDepth,
  onToggleCursorAwareness,
  onChangeMotion,
  onRunDriftCheck,
  onReviewPendingChanges,
  onLoadRecentFindings,
  onApprovePendingDraft,
  onAgentWake,
  onResetCera,
  onOpenAccessModal,
}: HeroSectionProps) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  return (
    <MotionConfig
      reducedMotion={controlsState.motion === 'reduced' ? 'always' : 'user'}
    >
      <section
        aria-label="Interactive 3D AI Agent Hero"
        className="relative w-full h-[calc(100vh-65px)] min-h-[520px] overflow-hidden bg-[#04070E]"
      >
        {/* Subtle radial atmospheric depth backdrop behind WebGL stage */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(37,99,235,0.14),rgba(4,7,14,0)_58%)]"
        />

        {/* Centered Minimalist Levitating 3D AI Agent Stage (Cera) */}
        <AgentStage3D
          controlsState={controlsState}
          controlsOpen={controlsOpen}
          resetCameraSignal={resetCameraSignal}
          onToggleControls={() => setControlsOpen((prev) => !prev)}
          onAgentInteract={() => {
            setInteractionCount((c) => c + 1);
            onAgentWake();
          }}
        />

        {/* Clean Left Hero Framing (center 3D Cera remains completely unobstructed) */}
        <div className="pointer-events-none absolute inset-0 z-10 mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="flex h-full flex-col justify-between pt-7 pb-10 lg:justify-center lg:py-12">
            <div className="max-w-xs sm:max-w-sm lg:max-w-[340px]">
              <p className="text-xs font-medium tracking-wide text-sky-400/90">
                Meet Cera
              </p>
              <h1 className="mt-3 font-display text-[clamp(2rem,3.2vw,3rem)] font-semibold leading-[1.08] tracking-tight text-white text-balance">
                Conscious AI, built around Cera.
              </h1>
              <p className="mt-4 text-sm sm:text-[15px] leading-relaxed tracking-wide text-slate-300/90">
                Move your cursor across the screen to guide Cera&apos;s gaze.
                Click the glowing core on Cera&apos;s chest to open the Control Centre.
              </p>

              <div className="pointer-events-auto mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenAccessModal}
                  className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  Get Started
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-3 mt-10 text-xs text-slate-500">
                <span>Cursor guides eyes</span>
                <span aria-hidden="true">·</span>
                <span>Drag to orbit</span>
                <span aria-hidden="true">·</span>
                <span>
                  Click core for Control Centre
                  {interactionCount > 0 ? ` · ${interactionCount}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cera Control Centre opened via chest core button */}
        <AnimatePresence>
          {controlsOpen && (
            <CeraControlCentre
              controlsState={controlsState}
              analysisConfig={analysisConfig}
              session={session}
              activeQuickAction={activeQuickAction}
              analysisOperation={analysisOperation}
              evidenceOperation={evidenceOperation}
              pendingDraftOperation={pendingDraftOperation}
              applyUpdateOperation={applyUpdateOperation}
              onSelectMode={onSelectMode}
              onToggleSource={onToggleSource}
              onChangeDepth={onChangeDepth}
              onToggleCursorAwareness={onToggleCursorAwareness}
              onChangeMotion={onChangeMotion}
              onRunDriftCheck={onRunDriftCheck}
              onReviewPendingChanges={onReviewPendingChanges}
              onLoadRecentFindings={onLoadRecentFindings}
              onApprovePendingDraft={onApprovePendingDraft}
              onReset={onResetCera}
              onClose={() => setControlsOpen(false)}
            />
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
