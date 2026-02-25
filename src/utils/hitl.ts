import { IMakerTask, IVotingCandidate } from '../types/maker.js';

/**
 * Interface for the ask_user tool parameters.
 */
interface IAskUserQuestion {
  header: string;
  question: string;
  type: 'choice' | 'text' | 'yesno';
  options?: Array<{ label: string; description: string }>;
  placeholder?: string;
  multiSelect?: boolean;
}

/**
 * Interface for the ask_user tool response.
 */
interface IAskUserResponse {
  answers: string[];
}

/**
 * Declaring the ask_user tool as a global function provided by the environment.
 * This allows the MAKER framework to interact with the user through the host's HITL capabilities.
 */
declare function ask_user(args: { questions: IAskUserQuestion[] }): Promise<IAskUserResponse>;

/**
 * Prompts the user for more details on an ambiguous task.
 * 
 * @param task - The task requiring clarification.
 * @returns A promise that resolves to the user's clarification text.
 */
export async function askUserClarification(task: IMakerTask): Promise<string> {
  const response = await ask_user({
    questions: [
      {
        header: 'Clarify Task',
        question: `The task "${task.description}" (ID: ${task.id}) needs more detail. Can you provide more information?`,
        type: 'text',
        placeholder: 'Enter additional details here...'
      }
    ]
  });

  if (!response || !response.answers || response.answers.length === 0) {
    throw new Error('No response received from user for clarification.');
  }

  return response.answers[0];
}

/**
 * Lets the user select a candidate or veto all.
 * 
 * @param task - The task for which candidates were generated.
 * @param candidates - The list of candidate solutions.
 * @returns A promise that resolves to the index of the selected candidate, or null if vetoed.
 */
export async function askUserVeto(task: IMakerTask, candidates: IVotingCandidate[]): Promise<number | null> {
  const options = candidates.map((c, index) => ({
    label: `Candidate ${index + 1}`,
    description: c.content.length > 100 ? c.content.substring(0, 97) + '...' : c.content
  }));

  // Add a veto option
  options.push({
    label: 'Veto All',
    description: 'Reject all candidates and request a retry or manual intervention.'
  });

  const response = await ask_user({
    questions: [
      {
        header: 'Candidate Review',
        question: `Please review the following candidates for the task: "${task.description}"`,
        type: 'choice',
        options: options
      }
    ]
  });

  if (!response || !response.answers || response.answers.length === 0) {
    return null;
  }

  const selectedLabel = response.answers[0];
  if (selectedLabel === 'Veto All') {
    return null;
  }

  // Find the index of the selected candidate
  const selectedIndex = options.findIndex(o => o.label === selectedLabel);
  
  // Ensure the index is within the original candidates range
  return selectedIndex !== -1 && selectedIndex < candidates.length ? selectedIndex : null;
}
