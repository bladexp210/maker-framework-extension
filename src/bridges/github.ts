import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Interface for GitHub repository management.
 */
export interface IGitHubRepo {
  owner: string;
  name: string;
  cloneUrl?: string;
  sshUrl?: string;
  description?: string;
  isPrivate?: boolean;
}

/**
 * Interface for GitHub commit details.
 */
export interface IGitHubCommit {
  repo: string;
  branch: string;
  message: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Wrapper for GitHub repository management and operations.
 * These functions typically invoke GitHub MCP tools or the 'gh' CLI.
 */

/**
 * Clones a GitHub repository to a specific path.
 * @param repo - The repo name in 'owner/name' format.
 * @param localPath - The directory to clone into.
 * @returns A promise that resolves to true if successful.
 */
export async function cloneRepo(repo: string, localPath: string): Promise<boolean> {
  console.log(`[GitHub Bridge] Cloning ${repo} to ${localPath}...`);
  try {
    // In a real MAKER environment, this would call 'gh repo clone' or equivalent MCP.
    // For now, we simulate the action and assume success if the environment is configured.
    await execFileAsync('gh', ['repo', 'clone', repo, localPath]);
    return true;
  } catch (error) {
    console.error(`[GitHub Bridge] Failed to clone ${repo}:`, error);
    return false;
  }
}

/**
 * Creates a new GitHub repository.
 * @param name - The name of the new repository.
 * @param description - An optional description.
 * @param isPrivate - Whether the repo should be private.
 * @returns A promise that resolves to the created repository information.
 */
export async function createRepo(name: string, description?: string, isPrivate = false): Promise<IGitHubRepo> {
  console.log(`[GitHub Bridge] Creating repository ${name}...`);
  try {
    const args = ['repo', 'create', name, isPrivate ? '--private' : '--public'];
    if (description) {
      args.push('--description', description);
    }
    const { stdout } = await execFileAsync('gh', args);
    const output = stdout.trim();
    
    // Output is usually the repo URL
    const parts = output.split('/');
    const repoName = parts.pop() || name;
    const owner = parts.pop() || 'unknown';

    return {
      owner,
      name: repoName,
      description,
      isPrivate,
      cloneUrl: output.endsWith('.git') ? output : `${output}.git`
    };
  } catch (error) {
    console.error(`[GitHub Bridge] Failed to create repo ${name}:`, error);
    throw error;
  }
}

/**
 * Creates a new branch in a GitHub repository.
 * @param localPath - Path to the local repository.
 * @param branchName - The name of the new branch.
 * @param baseBranch - The branch to branch off from (default 'main').
 * @returns A promise that resolves to true if successful.
 */
export async function createBranch(localPath: string, branchName: string, baseBranch = 'main'): Promise<boolean> {
  console.log(`[GitHub Bridge] Creating branch ${branchName} in ${localPath} from ${baseBranch}...`);
  try {
    await execFileAsync('git', ['-C', localPath, 'checkout', baseBranch]);
    await execFileAsync('git', ['-C', localPath, 'checkout', '-b', branchName]);
    return true;
  } catch (error) {
    console.error(`[GitHub Bridge] Failed to create branch ${branchName}:`, error);
    return false;
  }
}

/**
 * Commits changes and pushes to a branch.
 * @param localPath - Path to the local repository.
 * @param branch - The branch to push to.
 * @param message - The commit message.
 * @returns A promise that resolves to the commit SHA or success status.
 */
export async function commitAndPush(localPath: string, branch: string, message: string): Promise<string> {
  console.log(`[GitHub Bridge] Committing changes in ${localPath} to branch ${branch}...`);
  try {
    await execFileAsync('git', ['-C', localPath, 'add', '.']);
    await execFileAsync('git', ['-C', localPath, 'commit', '-m', message]);
    await execFileAsync('git', ['-C', localPath, 'push', 'origin', branch]);
    
    const { stdout } = await execFileAsync('git', ['-C', localPath, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch (error) {
    console.error(`[GitHub Bridge] Failed to commit and push:`, error);
    throw error;
  }
}

/**
 * Submits a pull request.
 * @param localPath - Path to the local repository.
 * @param title - The PR title.
 * @param body - The PR description.
 * @param head - The branch with changes.
 * @param base - The target branch (default 'main').
 * @returns A promise that resolves to the PR URL.
 */
export async function createPullRequest(localPath: string, title: string, body: string, head: string, base = 'main'): Promise<string> {
  console.log(`[GitHub Bridge] Creating PR for ${head} into ${base}...`);
  try {
    const { stdout } = await execFileAsync('gh', [
      'pr', 'create', 
      '--title', title, 
      '--body', body, 
      '--head', head, 
      '--base', base
    ], { 
      cwd: localPath
    });
    return stdout.trim(); // URL of the created PR
  } catch (error) {
    console.error(`[GitHub Bridge] Failed to create PR:`, error);
    throw error;
  }
}
