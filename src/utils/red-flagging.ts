import { IRedFlagResult, RedFlagSeverity } from '../types/maker.js';

/**
 * Logic for filtering unreliable agent outputs.
 * Implements rules to identify potential issues in proposed solutions.
 */
export function checkRedFlags(output: string): IRedFlagResult {
  const suggestions: string[] = [];
  let severity: RedFlagSeverity = 'low';
  let isRedFlagged = false;
  let reason = '';

  // Normalize output for checking
  const trimmedOutput = output.trim();

  // Rule 1: Minimum length check
  // Very short outputs are often refusals or errors
  if (trimmedOutput.length < 10) {
    return {
      isRedFlagged: true,
      severity: 'high',
      reason: 'Output is too short to be a valid solution.',
      suggestions: ['Provide a more detailed explanation or implementation.']
    };
  }

  // Rule 2: Forbidden patterns (e.g., AI refusal or uncertainty)
  const forbiddenPatterns = [
    { pattern: /I don't know/i, reason: 'Agent expressed uncertainty.' },
    { pattern: /as an AI/i, reason: 'Agent used generic AI disclaimer.' },
    { pattern: /I'm sorry, but/i, reason: 'Agent refused to perform the task.' },
    { pattern: /cannot fulfill this request/i, reason: 'Agent refused to perform the task.' },
    { pattern: /unable to process/i, reason: 'Agent reported inability to process.' }
  ];

  for (const { pattern, reason: patternReason } of forbiddenPatterns) {
    if (pattern.test(trimmedOutput)) {
      return {
        isRedFlagged: true,
        severity: 'medium',
        reason: patternReason,
        suggestions: ['Ensure the agent provides a direct answer without disclaimers.']
      };
    }
  }

  // Rule 3: Formatting check
  // If the output looks like it should contain code but doesn't have code blocks
  const hasCodeKeywords = /function\s+|class\s+|import\s+|const\s+|let\s+|var\s+|def\s+|package\s+|public\s+|private\s+/i.test(trimmedOutput);
  const hasCodeBlocks = /```/.test(trimmedOutput);

  if (hasCodeKeywords && !hasCodeBlocks) {
    isRedFlagged = true;
    severity = 'low';
    reason = 'Output contains code keywords but lacks markdown code blocks.';
    suggestions.push('Wrap code snippets in markdown code blocks for better readability.');
  }

  // Rule 4: Critical failure indicators
  // Explicit error messages from the underlying system or runtime
  if (/^Error:/i.test(trimmedOutput) || /Exception:/i.test(trimmedOutput) || /Traceback/i.test(trimmedOutput)) {
    return {
      isRedFlagged: true,
      severity: 'critical',
      reason: 'Output contains explicit error or exception messages.',
      suggestions: ['Debug the underlying issue causing the error.']
    };
  }

  // Rule 5: Repetition check (simple heuristic)
  // Check if the output repeats the same line many times
  const lines = trimmedOutput.split('\n');
  if (lines.length > 10) {
    const uniqueLines = new Set(lines.map(l => l.trim()));
    if (uniqueLines.size < lines.length * 0.5) {
      return {
        isRedFlagged: true,
        severity: 'medium',
        reason: 'Output contains excessive repetition.',
        suggestions: ['Check for infinite loops or repetitive generation patterns.']
      };
    }
  }

  return {
    isRedFlagged,
    reason: isRedFlagged ? reason : undefined,
    severity,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}
