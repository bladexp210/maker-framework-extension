import { IMakerTask, MakerConfig } from './types/maker.js';
import { TaskTreeManager } from './utils/task-tree.js';
import { StateManager } from './utils/state-manager.js';
import { DecompositionAgent } from './agents/decomposition.js';
import { VotingAgent } from './agents/voting.js';
import { createRepo } from './bridges/github.js';

/**
 * Orchestrates the Massively Decomposed Agentic Process (MDAP) lifecycle.
 * Manages task decomposition, voting, and result aggregation.
 */
export class MakerOrchestrator {
  private taskTreeManager: TaskTreeManager;
  private stateManager: StateManager;
  private decompositionAgent: DecompositionAgent;
  private votingAgent: VotingAgent;

  constructor() {
    this.taskTreeManager = new TaskTreeManager();
    this.stateManager = new StateManager();
    this.decompositionAgent = new DecompositionAgent(this.taskTreeManager);
    this.votingAgent = new VotingAgent();
  }

  /**
   * Runs the full MAKER process for a given idea.
   * 
   * @param idea - The high-level idea or goal to achieve.
   * @param config - Configuration for the MAKER framework.
   * @returns A promise that resolves to the root task of the completed process.
   */
  public async runMaker(idea: string, config: MakerConfig): Promise<IMakerTask> {
    console.log(`[Orchestrator] Starting MAKER process for: "${idea}"`);

    // 1. Initialize the Task Tree.
    const rootTask: IMakerTask = {
      id: 'root',
      description: idea,
      status: 'pending',
      metadata: { depth: 0 }
    };

    // 2. Set up the GitHub repository context.
    // Sanitize idea for repo name
    const repoName = idea.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
    console.log(`[Orchestrator] Setting up GitHub repository: ${repoName}`);
    
    try {
      const repo = await createRepo(repoName, `MAKER generated repository for: ${idea}`);
      rootTask.metadata!.repoName = `${repo.owner}/${repo.name}`;
    } catch (error) {
      console.warn(`[Orchestrator] Failed to create GitHub repo. Continuing without repo context.`);
    }

    // Initial state save
    await this.stateManager.saveState({
      rootTask,
      config,
      metadata: { startTime: new Date().toISOString() }
    });

    // 3. Recursively decompose and 4. Trigger VotingAgent
    await this.processTask(rootTask, rootTask, config);

    // Final state save
    await this.stateManager.updateState({ rootTask });

    console.log(`[Orchestrator] MAKER process completed for: "${idea}"`);
    return rootTask;
  }

  /**
   * Recursively processes a task: decomposes if complex, votes if minimal.
   */
  private async processTask(task: IMakerTask, root: IMakerTask, config: MakerConfig): Promise<void> {
    if (task.status === 'completed' || task.status === 'failed') {
      return;
    }

    task.status = 'in-progress';
    await this.stateManager.updateState({ rootTask: root });

    if (this.decompositionAgent.isMinimalTask(task)) {
      // 4. For each minimal task, trigger the VotingAgent.
      console.log(`[Orchestrator] Task ${task.id} is minimal. Running voting round...`);
      const voteResult = await this.votingAgent.runVotingRound(task, config);
      
      if (voteResult.winnerIndex !== -1) {
        task.status = 'completed';
      } else {
        task.status = 'failed';
      }
    } else {
      // 3. Recursively decompose the idea until "minimal" tasks are reached.
      console.log(`[Orchestrator] Decomposing task ${task.id}...`);
      const decompositionResult = await this.decompositionAgent.decomposeTask(task, config);
      
      if (decompositionResult.subtasks.length > 0) {
        this.decompositionAgent.addSubtasksToTree(task, root, decompositionResult);
        
        // Process subtasks
        if (task.subtasks) {
          for (const subtask of task.subtasks) {
            // Ensure subtask knows about the repo
            subtask.metadata = { 
              ...subtask.metadata, 
              repoName: task.metadata?.repoName 
            };
            await this.processTask(subtask, root, config);
          }
        }

        // 5. Aggregate and compose results as it moves back up the tree.
        this.aggregateResults(task);
      } else {
        // If no subtasks were generated but it's not minimal, it might be a leaf that failed decomposition
        // or reached max depth. Treat as minimal or fail.
        console.warn(`[Orchestrator] Task ${task.id} could not be decomposed further. Treating as minimal.`);
        const voteResult = await this.votingAgent.runVotingRound(task, config);
        if (voteResult.winnerIndex !== -1) {
          task.status = 'completed';
        } else {
          task.status = 'failed';
        }
      }
    }

    // 6. Persist state using StateManager.
    await this.stateManager.updateState({ rootTask: root });
  }

  /**
   * Aggregates results from subtasks into the parent task.
   */
  private aggregateResults(task: IMakerTask): void {
    if (!task.subtasks || task.subtasks.length === 0) return;

    const allCompleted = task.subtasks.every(st => st.status === 'completed');
    const anyFailed = task.subtasks.some(st => st.status === 'failed');

    if (allCompleted) {
      task.status = 'completed';
      // Simple aggregation: concatenate results
      task.result = task.subtasks.map(st => st.result).join('\n\n');
    } else if (anyFailed) {
      task.status = 'failed';
    }
  }

  /**
   * Resumes a previously saved MAKER process.
   * 
   * @param filePath - Path to the state file.
   * @returns A promise that resolves to the root task of the completed process.
   */
  public async resumeMaker(filePath?: string): Promise<IMakerTask> {
    const state = await this.stateManager.loadState(filePath);
    if (!state.rootTask || !state.config) {
      throw new Error('No saved state found to resume.');
    }

    console.log(`[Orchestrator] Resuming MAKER process for: "${state.rootTask.description}"`);
    
    // Find the first pending or in-progress task and continue
    await this.resumeProcess(state.rootTask, state.rootTask, state.config);
    
    return state.rootTask;
  }

  /**
   * Recursively resumes processing of tasks.
   */
  private async resumeProcess(task: IMakerTask, root: IMakerTask, config: MakerConfig): Promise<void> {
    if (task.status === 'completed' || task.status === 'failed') {
      return;
    }

    // If it has subtasks, resume them
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        await this.resumeProcess(subtask, root, config);
      }
      this.aggregateResults(task);
    } else {
      // Otherwise, process this task
      await this.processTask(task, root, config);
    }
  }
}
