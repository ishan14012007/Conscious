export type AgentMode = 'standby' | 'analyzing' | 'focused' | 'sleep';

export type AgentFinish = 'obsidian' | 'cobalt' | 'alloy';

export interface AgentControlsState {
  mode: AgentMode;
  finish: AgentFinish;
  explode: number; // 0 to 1
  trackCursor: boolean;
}
