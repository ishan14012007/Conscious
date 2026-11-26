import { Eye, EyeOff, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { AgentControlsState, AgentFinish, AgentMode } from '../types/agent';
import { AgentStage3D } from './AgentStage3D';

interface HeroSectionProps {
  controlsState: AgentControlsState;
  onChangeControls: (next: Partial<AgentControlsState>) => void;
  onOpenAccessModal: () => void;
}

const MODES: Array<{ id: AgentMode; label: string }> = [
  { id: 'standby', label: 'Standby' },
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'focused', label: 'Focused' },
  { id: 'sleep', label: 'Sleep' },
];

const FINISHES: Array<{ id: AgentFinish; label: string; swatch: string }> = [
  { id: 'obsidian', label: 'Obsidian', swatch: '#0f172a' },
  { id: 'cobalt', label: 'Cobalt', swatch: '#1d4ed8' },
  { id: 'alloy', label: 'Alloy', swatch: '#64748b' },
];

const SATELLITE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 23,
};

export function HeroSection({
  controlsState,
  onChangeControls,
  onOpenAccessModal,
}: HeroSectionProps) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);

  return (
    <MotionConfig reducedMotion="user">
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
          resetCameraSignal={resetSignal}
          onToggleControls={() => setControlsOpen((prev) => !prev)}
          onAgentInteract={() => setInteractionCount((c) => c + 1)}
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
                Click the glowing core on Cera&apos;s chest to open controls.
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
                  Click core for controls
                  {interactionCount > 0 ? ` · ${interactionCount}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right-Side No-Box Controls with Alternating Right / Left Alignment */}
        <AnimatePresence>
          {controlsOpen && (
            <motion.aside
              key="cera-alternating-controls"
              aria-label="Cera controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none hidden md:flex flex-col gap-6 absolute md:left-[calc(50%+145px)] lg:left-[calc(50%+180px)] xl:left-[calc(50%+205px)] top-1/2 -translate-y-1/2 w-[235px] lg:w-[290px] xl:w-[320px] z-20 drop-shadow-[0_2px_10px_rgba(4,7,14,0.95)]"
            >
              {/* Option 1 (Right-aligned): Behavior Modes */}
              <motion.div
                initial={{ opacity: 0, x: 56, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 36, scale: 0.96 }}
                transition={{ ...SATELLITE_TRANSITION, delay: 0.04 }}
                className="pointer-events-auto self-end flex flex-col items-end text-right"
              >
                <span className="block text-[11px] font-medium text-sky-400/80 mb-1.5">
                  Mode
                </span>
                <div
                  role="group"
                  aria-label="Cera mode"
                  className="flex flex-wrap justify-end items-center gap-3 lg:gap-4"
                >
                  {MODES.map((m) => {
                    const active = controlsState.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onChangeControls({ mode: m.id })}
                        className={`relative py-0.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                          active
                            ? 'text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                        {active && (
                          <motion.span
                            layoutId="cera-mode-indicator"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 30,
                            }}
                            className="absolute inset-x-0 -bottom-0.5 h-[1.5px] bg-sky-400"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Option 2 (Left-aligned): Chassis Finish */}
              <motion.div
                initial={{ opacity: 0, x: 34, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ ...SATELLITE_TRANSITION, delay: 0.09 }}
                className="pointer-events-auto self-start flex flex-col items-start text-left"
              >
                <span className="block text-[11px] font-medium text-sky-400/80 mb-1.5">
                  Chassis
                </span>
                <div
                  role="group"
                  aria-label="Cera chassis finish"
                  className="flex items-center gap-3"
                >
                  {FINISHES.map((f) => {
                    const active = controlsState.finish === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onChangeControls({ finish: f.id })}
                        aria-label={`${f.label} finish`}
                        title={f.label}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                          active
                            ? 'scale-115 ring-1 ring-sky-400'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-white/30"
                          style={{ backgroundColor: f.swatch }}
                        />
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Option 3 (Right-aligned): Exploded Layers Slider */}
              <motion.div
                initial={{ opacity: 0, x: 56, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 36, scale: 0.96 }}
                transition={{ ...SATELLITE_TRANSITION, delay: 0.14 }}
                className="pointer-events-auto self-end flex flex-col items-end text-right"
              >
                <div className="flex items-center justify-end gap-3 mb-1.5">
                  <span className="font-mono text-xs text-slate-300 tabular-nums">
                    {Math.round(controlsState.explode * 100)}%
                  </span>
                  <label
                    htmlFor="explode-slider"
                    className="text-[11px] font-medium text-sky-400/80 whitespace-nowrap"
                  >
                    Layers
                  </label>
                </div>
                <input
                  id="explode-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(controlsState.explode * 100)}
                  onChange={(e) =>
                    onChangeControls({
                      explode: Number(e.target.value) / 100,
                    })
                  }
                  className="agent-slider w-32"
                />
              </motion.div>

              {/* Option 4 (Left-aligned): Gaze Tracking */}
              <motion.div
                initial={{ opacity: 0, x: 34, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ ...SATELLITE_TRANSITION, delay: 0.19 }}
                className="pointer-events-auto self-start flex flex-col items-start text-left"
              >
                <button
                  type="button"
                  onClick={() =>
                    onChangeControls({
                      trackCursor: !controlsState.trackCursor,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    controlsState.trackCursor
                      ? 'text-sky-300 hover:text-sky-200'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {controlsState.trackCursor ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {controlsState.trackCursor ? 'Gaze On' : 'Gaze Off'}
                  </span>
                </button>
              </motion.div>

              {/* Option 5 (Right-aligned): Reset & Close */}
              <motion.div
                initial={{ opacity: 0, x: 56, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 36, scale: 0.96 }}
                transition={{ ...SATELLITE_TRANSITION, delay: 0.24 }}
                className="pointer-events-auto self-end flex items-center justify-end gap-5 text-right"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChangeControls({
                      mode: 'standby',
                      explode: 0,
                      trackCursor: true,
                    });
                    setResetSignal((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setControlsOpen(false)}
                  aria-label="Close controls"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
              </motion.div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Compact Unboxed Alternating Controls for Mobile (< 768px) */}
        <AnimatePresence>
          {controlsOpen && (
            <motion.aside
              key="cera-mobile-controls"
              aria-label="Cera mobile controls"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none md:hidden absolute inset-x-5 bottom-4 z-20 flex flex-col gap-2.5 drop-shadow-[0_2px_12px_rgba(4,7,14,0.95)]"
            >
              {/* Option 1 (Right-aligned): Mode */}
              <div
                role="group"
                aria-label="Cera mode"
                className="pointer-events-auto self-end flex flex-wrap justify-end items-center gap-3"
              >
                {MODES.map((m) => {
                  const active = controlsState.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeControls({ mode: m.id })}
                      className={`relative py-0.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      {m.label}
                      {active && (
                        <span className="absolute inset-x-0 -bottom-0.5 h-[1.5px] bg-sky-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Option 2 (Left-aligned): Chassis */}
              <div className="pointer-events-auto self-start flex items-center gap-2">
                {FINISHES.map((f) => {
                  const active = controlsState.finish === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onChangeControls({ finish: f.id })}
                      aria-label={`${f.label} finish`}
                      className={`flex h-5 w-5 items-center justify-center rounded-full cursor-pointer ${
                        active ? 'ring-1 ring-sky-400' : 'opacity-70'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/30"
                        style={{ backgroundColor: f.swatch }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Option 3 (Right-aligned): Layers */}
              <div className="pointer-events-auto self-end flex items-center gap-2">
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  {Math.round(controlsState.explode * 100)}%
                </span>
                <input
                  aria-label="Cera layer separation"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(controlsState.explode * 100)}
                  onChange={(e) =>
                    onChangeControls({
                      explode: Number(e.target.value) / 100,
                    })
                  }
                  className="agent-slider w-24"
                />
              </div>

              {/* Option 4 (Left-aligned): Gaze */}
              <div className="pointer-events-auto self-start">
                <button
                  type="button"
                  onClick={() =>
                    onChangeControls({
                      trackCursor: !controlsState.trackCursor,
                    })
                  }
                  className={`inline-flex items-center gap-1 text-xs font-medium cursor-pointer ${
                    controlsState.trackCursor
                      ? 'text-sky-300'
                      : 'text-slate-500'
                  }`}
                >
                  {controlsState.trackCursor ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  <span>{controlsState.trackCursor ? 'Gaze On' : 'Gaze Off'}</span>
                </button>
              </div>

              {/* Option 5 (Right-aligned): Reset & Close */}
              <div className="pointer-events-auto self-end flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onChangeControls({
                      mode: 'standby',
                      explode: 0,
                      trackCursor: true,
                    });
                    setResetSignal((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setControlsOpen(false)}
                  aria-label="Close controls"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-300 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}
