export type AgentMode = 'standby' | 'analyzing' | 'focused' | 'sleep';

export type AgentFinish = 'obsidian' | 'cobalt' | 'alloy';

export type AgentMotionMode = 'normal' | 'reduced';

export type IntelligenceSourceId =
  | 'jira'
  | 'confluence'
  | 'bitbucket'
  | 'jsm'
  | 'teamwork-graph';

export type AnalysisDepth = 'quick' | 'balanced' | 'deep';

export interface AgentControlsState {
  mode: AgentMode;
  finish: AgentFinish;
  explode: number; // 0 to 1
  trackCursor: boolean;
  motion: AgentMotionMode;
}

export interface CeraAnalysisConfig {
  selectedSources: IntelligenceSourceId[];
  depth: AnalysisDepth;
}
