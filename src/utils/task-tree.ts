import { IMakerTask } from '../types/maker.js';

/**
 * Manages operations on the hierarchical task decomposition tree.
 */
export class TaskTreeManager {
  /**
   * Adds a subtask to an existing task in the tree.
   * If parentTaskId is null, the task is considered the root.
   */
  public addTask(parentTaskId: string | null, newTask: IMakerTask, root: IMakerTask | null): IMakerTask {
    if (!parentTaskId) {
      if (root) {
        throw new Error('A root task already exists. Only one root is allowed per session.');
      }
      return newTask;
    }

    if (!root) {
      throw new Error('Cannot add a subtask to a non-existent root.');
    }

    const parentTask = this.findTask(root, parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentTaskId} not found.`);
    }

    if (!parentTask.subtasks) {
      parentTask.subtasks = [];
    }
    parentTask.subtasks.push(newTask);
    return root;
  }

  /**
   * Recursively finds a task with the given ID in the tree.
   */
  public findTask(root: IMakerTask | null, taskId: string): IMakerTask | undefined {
    if (!root) {
      return undefined;
    }

    if (root.id === taskId) {
      return root;
    }

    if (root.subtasks) {
      for (const subtask of root.subtasks) {
        const found = this.findTask(subtask, taskId);
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  /**
   * Updates the status of a specific task and recursively propagates status up if necessary.
   * In the MAKER framework, status propagation is usually context-specific.
   */
  public updateTask(root: IMakerTask | null, taskId: string, updates: Partial<IMakerTask>): IMakerTask | null {
    if (!root) {
      return null;
    }

    const task = this.findTask(root, taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found.`);
    }

    Object.assign(task, updates);
    return root;
  }

  /**
   * Retrieves all leaf tasks (tasks without subtasks) from the tree.
   */
  public getLeafNodes(root: IMakerTask | null): IMakerTask[] {
    if (!root) {
      return [];
    }

    const leaves: IMakerTask[] = [];

    const traverse = (node: IMakerTask) => {
      if (!node.subtasks || node.subtasks.length === 0) {
        leaves.push(node);
      } else {
        for (const subtask of node.subtasks) {
          traverse(subtask);
        }
      }
    };

    traverse(root);
    return leaves;
  }

  /**
   * Calculates the overall completion percentage based on the status of tasks.
   * Uses a weighted approach: 100% for completed, 0% for others.
   */
  public calculateCompletion(root: IMakerTask | null): number {
    if (!root) return 0;
    const allTasks: IMakerTask[] = [];

    const traverse = (node: IMakerTask) => {
      allTasks.push(node);
      if (node.subtasks) {
        for (const subtask of node.subtasks) {
          traverse(subtask);
        }
      }
    };

    traverse(root);

    if (allTasks.length === 0) return 0;

    const completedCount = allTasks.filter((task) => task.status === 'completed').length;
    return (completedCount / allTasks.length) * 100;
  }
}
