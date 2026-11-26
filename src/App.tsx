import { useState } from 'react';
import { AccessModal } from './components/AccessModal';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { AgentControlsState } from './types/agent';

export default function App() {
  const [controlsState, setControlsState] = useState<AgentControlsState>({
    mode: 'standby',
    finish: 'obsidian',
    explode: 0,
    trackCursor: true,
  });

  const [modalOpen, setModalOpen] = useState(false);

  const handleChangeControls = (next: Partial<AgentControlsState>) => {
    setControlsState((prev) => ({ ...prev, ...next }));
  };

  return (
    <div className="min-h-screen bg-[#04070E] text-[#E6EEF8]">
      <Header onOpenAccessModal={() => setModalOpen(true)} />

      <main>
        <HeroSection
          controlsState={controlsState}
          onChangeControls={handleChangeControls}
          onOpenAccessModal={() => setModalOpen(true)}
        />
      </main>

      <AccessModal
        open={modalOpen}
        initialTier="Production"
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
