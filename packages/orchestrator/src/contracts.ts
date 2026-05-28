/**
 * TaskContracts — Structured I/O contracts for agent communication.
 *
 * Every agent communicates through typed contracts rather than free-form
 * conversational memory. This ensures deterministic, inspectable handoffs
 * and prevents context pollution between stages.
 *
 * Each contract has:
 *   - A unique ID for traceability
 *   - Source and target stage identifiers
 *   - Typed input/output payloads
 *   - Status tracking (pending → fulfilled/rejected)
 *   - Timing for observability
 */

import { generateId, timestamp } from '@autic/shared';
import type {
  TaskContract,
  ContractType,
  OrchestrationStage,
  ResearchOutput,
  PlanningOutput,
  ArchitectureOutput,
  EngineeringOutput,
  VerificationOutput,
  RepairOutput,
  FinalReviewOutput,
} from '@autic/shared';

export type ContractPayload =
  | ResearchOutput
  | PlanningOutput
  | ArchitectureOutput
  | EngineeringOutput
  | VerificationOutput
  | RepairOutput
  | FinalReviewOutput;

/**
 * Create a new task contract between two orchestration stages.
 */
export function createContract(
  source: OrchestrationStage,
  target: OrchestrationStage,
  type: ContractType,
  input: Record<string, unknown> = {},
): TaskContract {
  return {
    id: generateId(),
    source,
    target,
    type,
    input,
    status: 'pending',
    startedAt: timestamp(),
  };
}

/**
 * Fulfill a contract with output data.
 */
export function fulfillContract(
  contract: TaskContract,
  output: Record<string, unknown>,
): TaskContract {
  return {
    ...contract,
    status: 'fulfilled',
    output,
    completedAt: timestamp(),
  };
}

/**
 * Reject a contract with an error.
 */
export function rejectContract(contract: TaskContract, error: string): TaskContract {
  return {
    ...contract,
    status: 'rejected',
    error,
    completedAt: timestamp(),
  };
}

/**
 * Extract type-safe payload from a fulfilled contract.
 */
export function getContractOutput<T extends ContractPayload>(
  contract: TaskContract,
): T | undefined {
  if (contract.status !== 'fulfilled' || !contract.output) {
    return undefined;
  }
  return contract.output as T;
}

/**
 * Summarize a contract for display/logging.
 */
export function summarizeContract(contract: TaskContract): string {
  const statusIcon =
    contract.status === 'fulfilled' ? '✓' : contract.status === 'rejected' ? '✗' : '…';

  const duration = contract.completedAt
    ? `${contract.completedAt - contract.startedAt}ms`
    : 'pending';

  return `${statusIcon} [${contract.source}→${contract.target}] ${contract.type} (${duration})`;
}
