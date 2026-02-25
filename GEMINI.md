# GEMINI.md: MAKER Gemini CLI Extension Internal Documentation

This document provides internal details for the Gemini CLI to understand and interact with the MAKER extension.

## Command: `maker`

The `maker` command is the entry point for the MAKER framework. It takes a high-level task description and initiates a recursive decomposition process.

### Parameters:
- `task` (string, required): The task to perform.

### Example:
```bash
gemini maker "Create a Python script for data analysis"
```

## Orchestrator and Subagents

The **MakerOrchestrator** manages the lifecycle of a task using a **Massively Decomposed Agentic Process (MDAP)**.

1.  **DecompositionAgent**: Recursively breaks down complex tasks into subtasks until they are "minimal."
2.  **VotingAgent**: Executes minimal tasks in parallel using the **Jules** bridge. It gathers multiple candidate solutions and selects a winner based on a **"first-to-ahead-by-k"** voting logic.
3.  **Red-flagging**: Filters out unreliable agent outputs (e.g., refusals, errors, or poor formatting) before they reach the voting stage.

## Iterative Clarification and Veto Mechanisms

MAKER incorporates **Human-In-The-Loop (HITL)** capabilities to handle ambiguity and ensure quality:

### 1. Iterative Clarification
If a task description is too vague for the **DecompositionAgent**, the orchestrator uses the `ask_user` tool to request more details from the user. This ensures that the decomposition is based on clear requirements.

### 2. User Veto
If the **VotingAgent** cannot reach a consensus after multiple rounds of sampling, it triggers a veto mechanism. The user is presented with the top candidate solutions and can:
- Select a preferred candidate.
- Veto all candidates and request a retry or manual intervention.

### Human-In-The-Loop (HITL) Tools

MAKER uses the `ask_user` tool for two main purposes:

- **Clarification**: When a task is too vague for decomposition, it asks for more details.
- **Veto/Selection**: When voting fails to reach a consensus, it presents the user with candidate solutions for selection or veto.

The `ask_user` tool should be available in the environment for these features to work.

## State Management

The framework persists its state in a `maker-state.json` file. This allows for:
- **Resumability**: If a process is interrupted, it can be resumed from the last saved task.
- **Auditability**: The full task tree, including all candidate solutions and vote counts, is recorded for review.

## Integration Points

- **GitHub Bridge**: Automatically creates repositories for project context.
- **Jules Bridge**: Executes minimal tasks in isolated environments.
- **TaskTreeManager**: Maintains the hierarchical structure of decomposed tasks.

---
<!-- Source: src/orchestrator.ts, src/utils/hitl.ts, src/utils/state-manager.ts -->
