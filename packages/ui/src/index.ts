/**
 * @autic/ui - Terminal UI components and design tokens
 */

export { theme } from './theme.js';
export type { Theme } from './theme.js';
export { createBox } from './components/Box.js';
export type { BoxOptions } from './components/Box.js';
export { colorText, label, heading, divider } from './components/Text.js';
export type { TextVariant } from './components/Text.js';

export { todoLine, renderTodoList, todoBoardHeader, statusLine, executionSummary } from './components/TodoList.js';
export type { TodoItem, TodoStatus, TodoListOptions } from './components/TodoList.js';

export {
  agentHeader,
  agentStatusLine,
  renderAgentPanel,
  compactAgentLine,
  agentSummary,
} from './components/AgentPanel.js';
export type { AgentDisplay, AgentStepDisplay, AgentStatus, AgentPanelOptions } from './components/AgentPanel.js';

export {
  pipelineHeader,
  stageLine,
  renderPipeline,
  compactPipelineLine,
  renderTransitions,
  pipelineSummary,
} from './components/OrchestrationPanel.js';
export type { PipelineStageStatus, PipelineStageDisplay, PipelineDisplay, ContractDisplay } from './components/OrchestrationPanel.js';

export {
  renderStabilityPanel,
  compactStabilityLine,
  queuePressureLine,
  memoryLine,
  providerHealthLine,
  workerLine,
} from './components/StabilityPanel.js';
export type { StabilityDisplay, HealthStatus, PressureLevel } from './components/StabilityPanel.js';

export {
  renderLearningPanel,
  compactLearningLine,
  confidenceLine,
  retrievalLine,
} from './components/LearningPanel.js';
export type { LearningDisplay } from './components/LearningPanel.js';

export {
  renderSwarmPanel,
  compactSwarmLine,
  delegationChainLine,
  workerUtilizationLine,
} from './components/SwarmPanel.js';
export type { SwarmDisplay } from './components/SwarmPanel.js';

export {
  renderContextPanel,
  compactContextLine,
  tokenBudgetLine,
  fileSelectionLine,
  compressionSavingsLine,
  safetyStatusLine,
} from './components/ContextPanel.js';
export type { ContextDisplay } from './components/ContextPanel.js';

export {
  getSpinnerFrame,
  spinnerLine,
  completionStatus,
  animatedProgressBar,
  dotProgress,
  startupHeader,
  startupFlow,
  providerStatusRow,
  queueStatusLine,
  memoryIndicator,
} from './components/LoadingSpinner.js';
export type { SpinnerStyle, SpinnerStatus } from './components/LoadingSpinner.js';
