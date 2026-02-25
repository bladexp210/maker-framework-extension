#!/usr/bin/env node
import { MakerOrchestrator } from './orchestrator.js';
import { MakerConfig } from './types/maker.js';

/**
 * Entry point for the MAKER Gemini CLI extension.
 * Handles command-line arguments and triggers the orchestrator.
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Simple argument parsing
  const params: Record<string, string> = {};
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        params[key] = value;
        i++;
      } else {
        params[key] = 'true';
      }
    } else {
      positionalArgs.push(args[i]);
    }
  }

  const command = positionalArgs[0];
  const orchestrator = new MakerOrchestrator();

  // Default configuration
  const defaultConfig: MakerConfig = {
    maxRecursionDepth: 3,
    votingThreshold: 2,
    redFlagSeverityThreshold: 'high',
    modelName: 'gemini-1.5-pro'
  };

  try {
    // Support for --task parameter from gemini-extension.json
    if (params.task) {
      await orchestrator.runMaker(params.task, defaultConfig);
      return;
    }

    switch (command) {
      case 'run': {
        const idea = positionalArgs.slice(1).join(' ');
        if (!idea) {
          console.error('Error: Please provide an idea for the MAKER process.');
          showHelp();
          process.exit(1);
        }
        await orchestrator.runMaker(idea, defaultConfig);
        break;
      }

      case 'resume': {
        const stateFile = positionalArgs[1];
        await orchestrator.resumeMaker(stateFile);
        break;
      }

      case 'help':
        showHelp();
        break;

      default:
        if (command) {
          // If a command is provided but not recognized, treat it as the idea for 'run'
          const idea = positionalArgs.join(' ');
          await orchestrator.runMaker(idea, defaultConfig);
        } else {
          showHelp();
        }
        break;
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Displays help information for the MAKER CLI.
 */
function showHelp() {
  console.log('MAKER Gemini CLI Extension');
  console.log('Usage:');
  console.log('  maker run <idea>    - Start a new MAKER process for the given idea');
  console.log('  maker resume [file] - Resume a previously saved MAKER process');
  console.log('  maker --task <idea> - Start a new MAKER process (Gemini CLI style)');
  console.log('  maker help          - Show this help message');
}

main();
