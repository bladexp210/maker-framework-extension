export type MakerStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
export type RedFlagSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents a task within the MAKER framework.
 * Supports recursive decomposition into subtasks.
 */
export interface IMakerTask {
  id: string;
  description: string;
  status: MakerStatus;
  subtasks?: IMakerTask[];
  result?: string;
  metadata?: Record<string, any>;
}

/**
 * Result of a red-flagging operation.
 * Used to identify issues in proposed solutions.
 */
export interface IRedFlagResult {
  isRedFlagged: boolean;
  reason?: string;
  severity: RedFlagSeverity;
  suggestions?: string[];
}

/**
 * Result of a voting operation.
 * Used to select the best candidate from multiple options.
 */
export interface IVoteResult {
  winnerIndex: number;
  confidence: number;
  rationale: string;
  votes: Record<number, number>;
}

/**
 * Configuration for the MAKER framework.
 */
export interface MakerConfig {
  maxRecursionDepth: number;
  votingThreshold: number;
  redFlagSeverityThreshold: RedFlagSeverity;
  modelName: string;
}

/**
 * Result of a decomposition operation.
 */
export interface IDecompositionResult {
  subtasks: string[];
  rationale: string;
}

/**
 * A candidate solution for voting.
 */
export interface IVotingCandidate {
  id: string;
  content: string;
}
