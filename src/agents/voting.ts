import { IMakerTask, MakerConfig, IVoteResult, IVotingCandidate } from '../types/maker.js';
import { runJulesTask, getJulesTaskStatus, IJulesTaskResult } from '../bridges/jules.js';
import { checkRedFlags } from '../utils/red-flagging.js';
import { askUserVeto } from '../utils/hitl.js';

/**
 * Agent responsible for voting on candidate solutions.
 * Implements the "first-to-ahead-by-k" voting logic.
 */
export class VotingAgent {
  /**
   * Runs a voting round for a given task.
   * Samples candidate solutions and determines a winner based on the voting threshold.
   * 
   * @param task - The task to vote on.
   * @param config - Configuration for the MAKER framework.
   * @returns A promise that resolves to the voting result.
   */
  public async runVotingRound(task: IMakerTask, config: MakerConfig): Promise<IVoteResult> {
    console.log(`[VotingAgent] Starting voting round for task: ${task.id}`);
    
    const k = config.votingThreshold;
    const candidates = new Map<string, number>(); // content -> index
    const candidateList: IVotingCandidate[] = []; // index -> candidate
    const votes: Record<number, number> = {};
    
    let winnerIndex = -1;
    let maxVotes = 0;
    let totalVotes = 0;
    
    // Configuration for sampling
    const batchSize = 3; // Number of parallel samples per batch
    const maxRounds = 10; // Maximum number of batches to run
    const repoName = task.metadata?.repoName || 'unknown/repo'; // Fallback if not provided

    for (let round = 0; round < maxRounds; round++) {
      console.log(`[VotingAgent] Round ${round + 1}/${maxRounds}: Sampling ${batchSize} candidates...`);
      
      // 1. Launch parallel tasks
      const sessionIds = await this.launchBatch(task, repoName, batchSize);
      
      // 2. Poll for results
      const results = await this.pollBatch(sessionIds);
      
      // 3. Process results
      for (const result of results) {
        if (result.status !== 'completed' || !result.output) {
          console.warn(`[VotingAgent] Task failed or no output for session: ${result.sessionId}`);
          continue;
        }

        // Check for red flags
        const redFlagResult = checkRedFlags(result.output);
        if (redFlagResult.isRedFlagged) {
          console.log(`[VotingAgent] Red flag detected for session ${result.sessionId}: ${redFlagResult.reason}`);
          continue; // Discard red-flagged result
        }

        // Canonicalize output (simple trim for now)
        const content = result.output.trim();
        
        // Register candidate if new
        let index = candidates.get(content);
        if (index === undefined) {
          index = candidateList.length;
          candidates.set(content, index);
          candidateList.push({ id: `candidate-${index}`, content });
          votes[index] = 0;
        }

        // Cast vote
        votes[index]++;
        totalVotes++;
        
        console.log(`[VotingAgent] Vote cast for candidate ${index}. Total votes: ${votes[index]}`);
      }

      // 4. Check for winner
      const sortedIndices = Object.keys(votes)
        .map(Number)
        .sort((a, b) => votes[b] - votes[a]);
      
      if (sortedIndices.length > 0) {
        const leaderIndex = sortedIndices[0];
        const leaderVotes = votes[leaderIndex];
        const runnerUpVotes = sortedIndices.length > 1 ? votes[sortedIndices[1]] : 0;
        
        if (leaderVotes >= runnerUpVotes + k) {
          console.log(`[VotingAgent] Winner found! Candidate ${leaderIndex} is ahead by ${leaderVotes - runnerUpVotes} (threshold: ${k}).`);
          winnerIndex = leaderIndex;
          maxVotes = leaderVotes;
          break;
        }
      }
    }

    // If no winner found after max rounds, trigger HITL veto
    if (winnerIndex === -1 && candidateList.length > 0) {
      console.warn('[VotingAgent] Max rounds reached without clear winner. Triggering HITL veto.');
      const selectedIndex = await askUserVeto(task, candidateList);
      
      if (selectedIndex !== null) {
        winnerIndex = selectedIndex;
        maxVotes = votes[winnerIndex] || 0;
        console.log(`[VotingAgent] User selected candidate ${winnerIndex}.`);
      } else {
        console.log('[VotingAgent] User vetoed all candidates.');
      }
    }

    if (winnerIndex === -1) {
      return {
        winnerIndex: -1,
        confidence: 0,
        rationale: 'No valid candidates found or user vetoed all options.',
        votes: {}
      };
    }

    // Update task with winner and candidates
    task.result = candidateList[winnerIndex].content;
    task.metadata = {
      ...task.metadata,
      candidates: candidateList,
      voteCounts: votes
    };

    // Calculate confidence (simple ratio)
    const confidence = totalVotes > 0 ? maxVotes / totalVotes : 0;

    return {
      winnerIndex,
      confidence,
      rationale: `Winner selected with ${maxVotes} votes (Total: ${totalVotes}).`,
      votes
    };
  }

  /**
   * Launches a batch of Jules tasks in parallel (conceptually).
   */
  private async launchBatch(task: IMakerTask, repoName: string, batchSize: number): Promise<string[]> {
    const promises: Promise<string>[] = [];
    
    for (let i = 0; i < batchSize; i++) {
      promises.push(this.startTask(task, repoName));
    }
    
    return Promise.all(promises);
  }

  /**
   * Starts a single Jules task and returns its session ID.
   */
  private async startTask(task: IMakerTask, repoName: string): Promise<string> {
    try {
      const result = await runJulesTask({
        repoName,
        description: task.description,
        wait: false
      });
      return result.sessionId;
    } catch (error) {
      console.error('[VotingAgent] Failed to start task:', error);
      return 'failed';
    }
  }

  /**
   * Polls a batch of sessions until completion.
   */
  private async pollBatch(sessionIds: string[]): Promise<IJulesTaskResult[]> {
    const activeSessions = sessionIds.filter(id => id !== 'failed');
    const results: Map<string, IJulesTaskResult> = new Map();
    const completed = new Set<string>();
    
    // Poll until all are done or timeout
    const maxPolls = 30; // 30 * 2s = 60s timeout per batch
    
    for (let i = 0; i < maxPolls; i++) {
      if (completed.size === activeSessions.length) break;
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      
      for (const sessionId of activeSessions) {
        if (completed.has(sessionId)) continue;
        
        try {
          const status = await getJulesTaskStatus(sessionId);
          if (status.status === 'completed' || status.status === 'failed') {
            results.set(sessionId, status);
            completed.add(sessionId);
          }
        } catch (error) {
          console.error(`[VotingAgent] Error polling session ${sessionId}:`, error);
          // Mark as failed to stop polling
          results.set(sessionId, { sessionId, status: 'failed', error: String(error) });
          completed.add(sessionId);
        }
      }
    }
    
    return activeSessions.map(id => results.get(id) || { sessionId: id, status: 'failed', error: 'Timeout' });
  }
}
