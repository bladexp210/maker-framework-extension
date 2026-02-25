import * as fs from 'fs/promises';
import { IMakerTask, MakerConfig } from '../types/maker.js';

/**
 * Interface representing the global state of the MAKER framework.
 */
export interface IMakerState {
  rootTask: IMakerTask | null;
  config: MakerConfig | null;
  metadata: Record<string, any>;
}

/**
 * Manages the persistence of the MAKER framework state.
 */
export class StateManager {
  private static DEFAULT_STATE_PATH = 'maker-state.json';

  /**
   * Loads the state from a JSON file.
   * If the file does not exist, returns a default empty state.
   */
  public async loadState(filePath: string = StateManager.DEFAULT_STATE_PATH): Promise<IMakerState> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as IMakerState;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.getDefaultState();
      }
      throw new Error(`Failed to load state from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Saves the state to a JSON file atomically using a temporary file.
   */
  public async saveState(state: IMakerState, filePath: string = StateManager.DEFAULT_STATE_PATH): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      const data = JSON.stringify(state, null, 2);
      await fs.writeFile(tempPath, data, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error: any) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore errors when deleting the temporary file
      }
      throw new Error(`Failed to save state to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Partially updates the state and saves it.
   */
  public async updateState(
    patch: Partial<IMakerState>,
    filePath: string = StateManager.DEFAULT_STATE_PATH
  ): Promise<IMakerState> {
    const currentState = await this.loadState(filePath);
    const newState: IMakerState = {
      ...currentState,
      ...patch,
      metadata: {
        ...currentState.metadata,
        ...(patch.metadata || {}),
      },
    };
    await this.saveState(newState, filePath);
    return newState;
  }

  /**
   * Returns a default empty state.
   */
  private getDefaultState(): IMakerState {
    return {
      rootTask: null,
      config: null,
      metadata: {},
    };
  }
}
