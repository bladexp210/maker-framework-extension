import { VotingAgent } from '../src/agents/voting.js';
import { checkRedFlags } from '../src/utils/red-flagging.js';
import { TaskTreeManager } from '../src/utils/task-tree.js';
import { IMakerTask, MakerConfig } from '../src/types/maker.js';
import * as julesBridge from '../src/bridges/jules.js';
import * as hitlUtils from '../src/utils/hitl.js';

jest.mock('../src/bridges/jules.js');
jest.mock('../src/utils/hitl.js');

describe('MAKER Logic Tests', () => {
  describe('VotingAgent', () => {
    let votingAgent: VotingAgent;
    let mockTask: IMakerTask;
    let mockConfig: MakerConfig;

    beforeEach(() => {
      jest.useFakeTimers();
      votingAgent = new VotingAgent();
      mockTask = {
        id: 'test-task',
        description: 'Test Task Description',
        status: 'pending',
        metadata: { repoName: 'test/repo' }
      };
      mockConfig = {
        votingThreshold: 2,
        maxRecursionDepth: 3,
        redFlagSeverityThreshold: 'medium',
        modelName: 'test-model'
      };
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should select a winner when a candidate is ahead by k', async () => {
      const runJulesTaskMock = julesBridge.runJulesTask as jest.Mock;
      const getJulesTaskStatusMock = julesBridge.getJulesTaskStatus as jest.Mock;

      // Round 1: 3 candidates
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's1' });
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's2' });
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's3' });

      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's1', status: 'completed', output: 'Solution A' });
      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's2', status: 'completed', output: 'Solution A' });
      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's3', status: 'completed', output: 'Solution B' });

      // Round 2: 3 more candidates
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's4' });
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's5' });
      runJulesTaskMock.mockResolvedValueOnce({ sessionId: 's6' });

      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's4', status: 'completed', output: 'Solution A' });
      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's5', status: 'completed', output: 'Solution B' });
      getJulesTaskStatusMock.mockResolvedValueOnce({ sessionId: 's6', status: 'completed', output: 'Solution A' });

      const promise = votingAgent.runVotingRound(mockTask, mockConfig);
      
      // Fast-forward timers to handle polling
      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }

      const result = await promise;

      expect(result.winnerIndex).toBe(0);
      expect(mockTask.result).toBe('Solution A');
      expect(result.votes[0]).toBe(4);
      expect(result.votes[1]).toBe(2);
    });

    it('should trigger HITL veto if no winner is found after max rounds', async () => {
      const runJulesTaskMock = julesBridge.runJulesTask as jest.Mock;
      const getJulesTaskStatusMock = julesBridge.getJulesTaskStatus as jest.Mock;
      const askUserVetoMock = hitlUtils.askUserVeto as jest.Mock;

      runJulesTaskMock.mockImplementation(async () => ({ 
        sessionId: `s-${Math.random().toString(36).substring(7)}` 
      }));
      
      let toggle = true;
      getJulesTaskStatusMock.mockImplementation(async (sessionId) => {
        toggle = !toggle;
        return { sessionId, status: 'completed', output: toggle ? 'Solution A' : 'Solution B' };
      });

      askUserVetoMock.mockResolvedValue(0); // User selects candidate 0 (B)

      const promise = votingAgent.runVotingRound(mockTask, mockConfig);

      // Fast-forward timers for all rounds
      for (let i = 0; i < 300; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }

      const result = await promise;

      expect(askUserVetoMock).toHaveBeenCalled();
      expect(result.winnerIndex).toBe(0);
      expect(mockTask.result).toBe('Solution B');
    });
  });

  describe('Red-flagging Logic', () => {
    it('should flag very short outputs', () => {
      const result = checkRedFlags('Too short');
      expect(result.isRedFlagged).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('should flag forbidden patterns', () => {
      const result = checkRedFlags('I am sorry, but I cannot fulfill this request.');
      expect(result.isRedFlagged).toBe(true);
      expect(result.reason).toContain('refused');
    });

    it('should flag code keywords without code blocks', () => {
      const result = checkRedFlags('Here is the code: const x = 10;');
      expect(result.isRedFlagged).toBe(true);
      expect(result.reason).toContain('lacks markdown code blocks');
    });

    it('should flag explicit error messages', () => {
      const result = checkRedFlags(`Error: something went wrong
Traceback: ...`);
      expect(result.isRedFlagged).toBe(true);
      expect(result.reason).toContain('explicit error');
    });

    it('should flag excessive repetition', () => {
      const repeatedText = `This is a test.
`.repeat(20);
      const result = checkRedFlags(repeatedText);
      expect(result.isRedFlagged).toBe(true);
      expect(result.reason).toContain('excessive repetition');
    });

    it('should pass valid outputs', () => {
      const validOutput = `This is a valid solution.
\`\`\`javascript
const x = 10;
\`\`\``;
      const result = checkRedFlags(validOutput);
      expect(result.isRedFlagged).toBe(false);
    });
  });

  describe('TaskTreeManager', () => {
    let manager: TaskTreeManager;

    beforeEach(() => {
      manager = new TaskTreeManager();
    });

    it('should add a root task', () => {
      const root: IMakerTask = { id: 'root', description: 'root', status: 'pending' };
      const result = manager.addTask(null, root, null);
      expect(result).toBe(root);
    });

    it('should add subtasks', () => {
      const root: IMakerTask = { id: 'root', description: 'root', status: 'pending' };
      const subtask: IMakerTask = { id: 'sub1', description: 'sub1', status: 'pending' };
      
      manager.addTask('root', subtask, root);
      
      expect(root.subtasks).toBeDefined();
      expect(root.subtasks![0]).toBe(subtask);
    });

    it('should find a task by ID', () => {
      const root: IMakerTask = { 
        id: 'root', 
        description: 'root', 
        status: 'pending',
        subtasks: [
          { id: 'sub1', description: 'sub1', status: 'pending' },
          { id: 'sub2', description: 'sub2', status: 'pending', subtasks: [
            { id: 'sub2-1', description: 'sub2-1', status: 'pending' }
          ]}
        ]
      };

      const found = manager.findTask(root, 'sub2-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('sub2-1');
    });

    it('should calculate completion percentage', () => {
      const root: IMakerTask = { 
        id: 'root', 
        description: 'root', 
        status: 'completed',
        subtasks: [
          { id: 'sub1', description: 'sub1', status: 'completed' },
          { id: 'sub2', description: 'sub2', status: 'pending' }
        ]
      };

      // 2 out of 3 tasks are completed
      const completion = manager.calculateCompletion(root);
      expect(completion).toBeCloseTo(66.67, 2);
    });

    it('should get leaf nodes', () => {
      const root: IMakerTask = { 
        id: 'root', 
        description: 'root', 
        status: 'pending',
        subtasks: [
          { id: 'sub1', description: 'sub1', status: 'pending' },
          { id: 'sub2', description: 'sub2', status: 'pending', subtasks: [
            { id: 'sub2-1', description: 'sub2-1', status: 'pending' }
          ]}
        ]
      };

      const leaves = manager.getLeafNodes(root);
      expect(leaves.length).toBe(2);
      expect(leaves.map(l => l.id)).toContain('sub1');
      expect(leaves.map(l => l.id)).toContain('sub2-1');
    });
  });
});
