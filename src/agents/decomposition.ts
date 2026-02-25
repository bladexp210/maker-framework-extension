import { IMakerTask, MakerConfig, IDecompositionResult } from '../types/maker.js';
import { TaskTreeManager } from '../utils/task-tree.js';
import { runJulesTask } from '../bridges/jules.js';

/**
 * Agent responsible for decomposing complex tasks into smaller, manageable subtasks.
 * This follows the MAKER framework's recursive decomposition pattern.
 */
export class DecompositionAgent {
  private taskTreeManager: TaskTreeManager;

  constructor(taskTreeManager: TaskTreeManager) {
    this.taskTreeManager = taskTreeManager;
  }

  /**
   * Decomposes a task into subtasks using an LLM-based approach via Jules.
   * 
   * @param task - The task to decompose.
   * @param config - Configuration for the MAKER framework.
   * @returns A promise that resolves to the decomposition result.
   */
  public async decomposeTask(task: IMakerTask, config: MakerConfig): Promise<IDecompositionResult> {
    console.log(`[DecompositionAgent] Decomposing task: ${task.id} - ${task.description}`);

    // Check if we've reached the maximum recursion depth.
    const currentDepth = task.metadata?.depth || 0;
    if (currentDepth >= config.maxRecursionDepth) {
      console.log(`[DecompositionAgent] Max recursion depth reached for task: ${task.id}`);
      return {
        subtasks: [],
        rationale: 'Maximum recursion depth reached.'
      };
    }

    const repoName = task.metadata?.repoName || 'default-repo';
    const prompt = this.constructDecompositionPrompt(task, config, currentDepth);

    try {
      const result = await runJulesTask({
        repoName,
        description: prompt,
        wait: true
      });

      if (result.status === 'failed') {
        throw new Error(result.error || 'Jules task failed without error message');
      }

      return this.parseDecompositionResponse(result.output || '', task);
    } catch (error: any) {
      console.error(`[DecompositionAgent] Error during decomposition: ${error.message}`);
      
      // Fallback to a basic decomposition to allow the process to continue if LLM fails
      // This ensures the framework is resilient to transient LLM or bridge failures.
      return {
        subtasks: [
          `Step 1: Research and plan for "${task.description}"`,
          `Step 2: Implement the core components of "${task.description}"`,
          `Step 3: Test and verify "${task.description}"`
        ],
        rationale: `Fallback decomposition due to error: ${error.message}`
      };
    }
  }

  /**
   * Constructs a specialized prompt for task decomposition.
   */
  private constructDecompositionPrompt(task: IMakerTask, config: MakerConfig, depth: number): string {
    return `
You are a task decomposition agent in the MAKER framework.
Your goal is to break down a complex task into 2-5 smaller, manageable subtasks.

Task to decompose: "${task.description}"
Current recursion depth: ${depth}
Max recursion depth: ${config.maxRecursionDepth}

Instructions:
1. Analyze the task and determine if it can be broken down into smaller, logical steps.
2. If the task is simple enough to be executed directly (minimal), indicate this.
3. Return your response ONLY as a valid JSON object with the following structure:
{
  "subtasks": ["subtask 1", "subtask 2", ...],
  "rationale": "Explanation of the decomposition strategy",
  "isMinimal": true
}

If the task is NOT minimal, set "isMinimal" to false and provide subtasks.
If "isMinimal" is true, "subtasks" must be an empty array [].
Do not include any other text, markdown formatting, or explanations outside the JSON object.
`;
  }

  /**
   * Parses the LLM response and extracts the decomposition result.
   */
  private parseDecompositionResponse(output: string, task: IMakerTask): IDecompositionResult {
    try {
      // Extract JSON block from output (handles cases where LLM might include markdown or extra text)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in output');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.isMinimal === true) {
        task.metadata = { ...task.metadata, isMinimal: true };
        return {
          subtasks: [],
          rationale: parsed.rationale || 'Task determined to be minimal.'
        };
      }

      return {
        subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
        rationale: parsed.rationale || 'Decomposition successful.'
      };
    } catch (error: any) {
      throw new Error(`Failed to parse decomposition response: ${error.message}`);
    }
  }

  /**
   * Determines if a task is "minimal" and does not need further decomposition.
   * A minimal task is one that is simple enough to be executed directly.
   * 
   * @param task - The task to check.
   * @returns True if the task is minimal, false otherwise.
   */
  public isMinimalTask(task: IMakerTask): boolean {
    // A task is minimal if it's explicitly marked as such in metadata.
    if (task.metadata?.isMinimal === true) {
      return true;
    }

    // If it already has subtasks, it's a composite task, not a minimal one.
    if (task.subtasks && task.subtasks.length > 0) {
      return false;
    }

    // Heuristic: tasks with very short descriptions (3 words or fewer) are likely minimal.
    const wordCount = task.description.trim().split(/\s+/).length;
    if (wordCount <= 3) {
      return true;
    }

    return false;
  }

  /**
   * Integrates the decomposition result into the task tree by adding subtasks.
   * This uses the TaskTreeManager to ensure the tree structure is maintained.
   * 
   * @param parentTask - The task that was decomposed.
   * @param root - The root of the task tree.
   * @param result - The result of the decomposition.
   * @returns The updated root of the task tree.
   */
  public addSubtasksToTree(parentTask: IMakerTask, root: IMakerTask, result: IDecompositionResult): IMakerTask {
    const currentDepth = parentTask.metadata?.depth || 0;

    for (const subtaskDescription of result.subtasks) {
      const subtask: IMakerTask = {
        id: this.generateId(),
        description: subtaskDescription,
        status: 'pending',
        metadata: {
          depth: currentDepth + 1
        }
      };

      this.taskTreeManager.addTask(parentTask.id, subtask, root);
    }

    return root;
  }

  /**
   * Generates a unique ID for a new task.
   */
  private generateId(): string {
    return `task-${Math.random().toString(36).substring(2, 11)}`;
  }
}
