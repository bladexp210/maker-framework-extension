import { execFile } from 'child_process';
import { promisify } from 'util';
import { IMakerTask } from '../types/maker.js';

const execFileAsync = promisify(execFile);

/**
 * Interface for the result of a Jules task.
 */
export interface IJulesTaskResult {
  sessionId: string;
  status: 'started' | 'completed' | 'failed' | 'pending';
  consoleLink?: string;
  output?: string;
  error?: string;
}

/**
 * Interface for Jules task configuration.
 */
export interface IJulesTaskOptions {
  repoName: string;
  description: string;
  wait?: boolean;
}

/**
 * Bridge for triggering tasks in the 'jules' extension.
 * This interacts with the Jules CLI to start and monitor tasks.
 */

/**
 * Triggers a new Jules task for a specific repository.
 * 
 * @param options - Configuration for the Jules task.
 * @returns A promise that resolves to the result of the task execution.
 */
export async function runJulesTask(options: IJulesTaskOptions): Promise<IJulesTaskResult> {
  const { repoName, description, wait = false } = options;
  console.log(`[Jules Bridge] Triggering Jules task for repo: ${repoName}...`);
  console.log(`[Jules Bridge] Task Description: ${description}`);

  try {
    const args = ['start', '--repo', repoName, '--description', description];
    if (wait) {
      args.push('--wait');
    }
    
    const { stdout: output } = await execFileAsync('jules', args);
    
    // Parse output to find console link and session ID.
    // Output often includes: "Session started: <id>" and "Link: <url>"
    const sessionIdMatch = output.match(/Session\s+ID:\s+([a-zA-Z0-9-]+)/i);
    const linkMatch = output.match(/Link:\s+(https:\/\/[^\s]+)/i);

    const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'unknown';
    const consoleLink = linkMatch ? linkMatch[1] : undefined;

    return {
      sessionId,
      status: wait ? 'completed' : 'started',
      consoleLink,
      output: output.trim()
    };
  } catch (error: any) {
    console.error('[Jules Bridge] Error triggering Jules task:', error.message);
    return {
      sessionId: 'failed',
      status: 'failed',
      error: error.message,
      output: error.stdout ? error.stdout.toString() : ''
    };
  }
}

/**
 * Retrieves the status of an existing Jules task.
 * 
 * @param sessionId - The unique identifier for the Jules session.
 * @returns A promise that resolves to the current status of the task.
 */
export async function getJulesTaskStatus(sessionId: string): Promise<IJulesTaskResult> {
  console.log(`[Jules Bridge] Checking status for Jules session: ${sessionId}...`);
  try {
    const { stdout: output } = await execFileAsync('jules', ['status', '--id', sessionId]);
    
    // Simplified status parsing.
    let status: IJulesTaskResult['status'] = 'pending';
    if (output.toLowerCase().includes('completed')) status = 'completed';
    if (output.toLowerCase().includes('failed')) status = 'failed';
    if (output.toLowerCase().includes('in progress')) status = 'started';

    return {
      sessionId,
      status,
      output: output.trim()
    };
  } catch (error: any) {
    console.error(`[Jules Bridge] Error checking Jules task status for session ${sessionId}:`, error.message);
    return {
      sessionId,
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Converts an IMakerTask into a Jules task and runs it.
 * This allows the MAKER framework to delegate tasks to Jules.
 * 
 * @param task - The MAKER task to be delegated.
 * @param repoName - The repository name (owner/repo).
 * @returns A promise that resolves to the updated task with result metadata.
 */
export async function delegateToJules(task: IMakerTask, repoName: string): Promise<IMakerTask> {
  console.log(`[Jules Bridge] Delegating IMakerTask ${task.id} to Jules...`);
  
  const result = await runJulesTask({
    repoName,
    description: task.description,
    wait: false
  });

  // Update task with metadata about the Jules session.
  task.status = result.status === 'failed' ? 'failed' : 'in-progress';
  task.metadata = {
    ...task.metadata,
    julesSessionId: result.sessionId,
    julesConsoleLink: result.consoleLink
  };

  if (result.error) {
    task.result = `Jules delegation failed: ${result.error}`;
  }

  return task;
}
