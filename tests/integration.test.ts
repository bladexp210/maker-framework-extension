import { MakerOrchestrator } from '../src/orchestrator.js';
import { MakerConfig, IMakerTask } from '../src/types/maker.js';
import * as julesBridge from '../src/bridges/jules.js';
import * as githubBridge from '../src/bridges/github.js';
import * as hitlUtils from '../src/utils/hitl.js';
import fs from 'fs';
import path from 'path';

jest.setTimeout(60000);

// Mock the bridges and utilities
jest.mock('../src/bridges/jules.js');
jest.mock('../src/bridges/github.js');
jest.mock('../src/utils/hitl.js');

describe('MakerOrchestrator Integration Test', () => {
  let orchestrator: MakerOrchestrator;
  let config: MakerConfig;
  const stateDir = path.join(process.cwd(), '.maker');

  beforeEach(() => {
    orchestrator = new MakerOrchestrator();
    config = {
      votingThreshold: 1,
      maxRecursionDepth: 1,
      redFlagSeverityThreshold: 'medium',
      modelName: 'test-model'
    };

    // Mock GitHub repo creation
    (githubBridge.createRepo as jest.Mock).mockResolvedValue({
      owner: 'test-owner',
      name: 'test-repo',
      cloneUrl: 'https://github.com/test-owner/test-repo.git'
    });

    // Mock Jules task execution
    (julesBridge.runJulesTask as jest.Mock).mockImplementation(async (args) => {
      const sessionId = `session-${Math.random().toString(36).substring(7)}`;
      
      if (args.wait && args.description.includes('decompose')) {
        return {
          sessionId,
          status: 'completed',
          output: JSON.stringify({
            subtasks: [
              'Task 1: Design',
              'Task 2: Implement',
              'Task 3: Test'
            ],
            rationale: 'Mocked decomposition',
            isMinimal: false
          })
        };
      }
      
      return { sessionId, status: args.wait ? 'completed' : 'started' };
    });

    (julesBridge.getJulesTaskStatus as jest.Mock).mockImplementation(async (sessionId) => {
      return {
        sessionId,
        status: 'completed',
        output: `This is a valid solution for the task.
\`\`\`javascript
console.log("Hello World");
\`\`\``
      };
    });

    // Mock HITL
    (hitlUtils.askUserVeto as jest.Mock).mockResolvedValue(0);
    (hitlUtils.askUserClarification as jest.Mock).mockResolvedValue('Clarified');

    // Mock the delay in VotingAgent to speed up tests
    // We use (orchestrator as any) to access the private votingAgent
    jest.spyOn((orchestrator as any).votingAgent, 'pollBatch').mockImplementation(async (sessionIds: any) => {
      const results = [];
      for (const id of sessionIds) {
        results.push(await julesBridge.getJulesTaskStatus(id));
      }
      return results;
    });

    // Clean up state directory if it exists
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it('should decompose, solve, and aggregate a high-level idea', async () => {
    const idea = 'Build a simple calculator';
    
    const rootTask = await orchestrator.runMaker(idea, config);

    // Verify root task
    expect(rootTask.description).toBe(idea);
    expect(rootTask.status).toBe('completed');
    
    // Verify decomposition happened
    expect(rootTask.subtasks).toBeDefined();
    expect(rootTask.subtasks!.length).toBe(3);

    // Verify subtasks are completed
    for (const subtask of rootTask.subtasks!) {
      expect(subtask.status).toBe('completed');
      expect(subtask.result).toBeDefined();
    }

    // Verify aggregation
    expect(rootTask.result).toBeDefined();

    // Verify GitHub bridge was called
    expect(githubBridge.createRepo).toHaveBeenCalled();
  });

  it('should handle failures in voting and mark tasks as failed', async () => {
    // Mock Jules to fail
    (julesBridge.getJulesTaskStatus as jest.Mock).mockImplementation(async (sessionId) => {
      return {
        sessionId,
        status: 'failed',
        error: 'Simulated failure'
      };
    });

    // Mock HITL to veto everything
    (hitlUtils.askUserVeto as jest.Mock).mockResolvedValue(null);

    const idea = 'Fail Task';
    const rootTask = await orchestrator.runMaker(idea, config);

    expect(rootTask.status).toBe('failed');
  });
});
