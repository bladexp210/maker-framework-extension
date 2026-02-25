# Design Document: MAKER Framework Gemini CLI Extension
**Date:** February 24, 2026
**Slug:** maker-extension
**Status:** Approved

## 1. Problem Statement
The goal is to implement a Gemini CLI extension that operationalizes the **MAKER (Maximal Agentic decomposition, first-to-ahead-by-K Error correction, and Red-flagging)** framework, leveraging **Google Jules** as the core execution engine. Modern LLM-based systems often struggle with long-horizon, complex tasks due to an inherent error rate that compounds over many steps. For example, a 1% error rate leads to failure after only 100 steps on average. 

The **MAKER** framework solves this by:
1.  **Decomposing** tasks into the smallest possible, "minimal" subtasks (Massively Decomposed Agentic Processes or MDAPs).
2.  Implementing **error-correction** at each step through **first-to-ahead-by-k voting**, where multiple agent candidates are sampled until a winner emerges.
3.  **Red-flagging** suspect outputs (unreliable, incorrectly formatted, or overly long) before they reach the voting stage.

This extension aims to provide a **generalized** interface to go from a high-level "Idea" to a complete "Product" with near-zero errors, incorporating **Human-in-the-Loop (HITL)** clarification and veto powers for maximum reliability and user alignment.

## 2. Requirements

### Functional Requirements
- **Git & GitHub Integration:** Implement support for creating, cloning, and managing GitHub repositories using the `github` extension (MCP).
- **Recursive Decomposition (MAD):** Implement a `DecompositionAgent` that recursively breaks a top-level task into minimal subtasks.
- **First-to-ahead-by-k Voting:** Implement logic to sample multiple Jules agent outputs until a candidate reaches a threshold of `k` votes ahead of its nearest rival.
- **Red-flagging Parser:** Filter out unreliable or incorrectly formatted agent outputs using rule-based and LLM-based detection.
- **Event-Driven Veto (HITL):** Provide an interactive mode where the user is prompted to clarify ambiguous points or veto specific decisions when red-flags are detected or voting confidence is low.
- **Jules Integration:** Use the `jules` extension as the primary "Thinking Module" for solving minimal subtasks, ensuring it has access to the relevant GitHub repository.
- **Iterative Clarification:** The orchestrator must engage with the user at key decision points, especially during decomposition, to clarify ambiguity before proceeding.

### Non-Functional Requirements
- **Reliability:** Target near-zero error rates through extreme decomposition and robust voting.
- **Observability:** Provide clear logs and visualization of the MDAP lifecycle (Decomposition -> Solve -> Vote -> Compose).
- **Cost Efficiency:** Allow users to set a `Global Threshold` for confidence (`high`, `medium`, `low`) to balance error-correction costs with accuracy.

### Constraints
- **Platform:** Must be a TypeScript-based Gemini CLI extension.
- **Tools:** Must leverage the `jules` extension and the `github` extension (MCP).
- **Runtime:** Must run on Node.js/TypeScript within the Gemini CLI environment.

## 3. Approach

### Selected Approach: Maestro-style Orchestrator (TypeScript/Node.js)
The chosen approach is a **centralized orchestrator** that manages the entire MDAP (Massively Decomposed Agentic Process) lifecycle. It will be implemented as a **TypeScript Gemini CLI extension**.

**Architecture and Workflow**:
1.  **Orchestrator Engine:** Coordinates the recursive decomposition and task execution. It maintains a persistent state of the "Decomposition Tree."
2.  **Git/GitHub Controller:** Before decomposition starts, it ensures the project environment is set up by interacting with the `github` extension (MCP) for repo creation/cloning.
3.  **Recursive Decomposition (MAD):** For each node in the tree, the `DecompositionAgent` splits it into smaller sub-tasks until they are "minimal." At each split, if ambiguity is detected, it pauses to **Clarify with the User**.
4.  **Thinking & Voting (First-to-ahead-by-k):** For each "minimal" task, the orchestrator triggers $n$ parallel samples ($n \ge 2k-1$) by calling the `jules` extension.
5.  **Red-flagging & Result Filtering:** Each sample is passed through a `RedFlaggingParser`. Suspect outputs (bad formatting, excessive length, or hallucination signs) are discarded.
6.  **Voting & Veto:** If a clear winner ($k$ votes ahead) emerges, it proceeds. If the vote is split, confidence is low, or red-flags are frequent, the user is prompted for a **Veto or Selection**.
7.  **Composition:** Results are recursively aggregated back up the tree to form the final product.

### Why this Approach?
By separating the orchestration (MAKER logic) from execution (Jules tasks), we gain precise control over the error-correction mechanisms (Voting & Red-flagging) and ensure a robust **Human-in-the-Loop** experience, which is critical for complex "Idea to Product" workflows.

## 4. Architecture

### Component Diagram

```
[Gemini CLI] 
      |
[MAKER Extension (Node.js/TS)]
      |
      +--- [MakerEngine] (Orchestrates recursive decomposition, task queue, and state)
      |         |
      |         +--- [DecompositionAgent] (Splits tasks into subtasks recursively)
      |         +--- [VotingAgent] (Samples outputs, applies 'first-to-ahead-by-k' logic)
      |         +--- [RedFlaggingParser] (LLM-based + Rule-based output filtering)
      |
      +--- [Git/GitHub Bridge] (Interacts with the 'github' MCP extension)
      |
      +--- [Jules Bridge] (Calls the 'jules' extension for 'minimal subtasks')
      |
      +--- [User Interaction Module] (Handles iterative clarification and Veto/Approval prompts)
```

### Key Interfaces
-   `IMakerTask`: Defines the structure of a task node (title, description, status, subtasks, results).
-   `IRedFlagResult`: Defines the output of the red-flagging parser (isValid, reason, score).
-   `IVoteResult`: Defines the outcome of a voting round (winner, votes, confidence, candidates).

### State Persistence
All state is stored in a `maker-state.json` file, allowing for multi-session execution and recovery from crashes.

## 5. Agent Team
-   **Decomposition Agent:** Breaks a high-level task into smaller sub-tasks recursively.
-   **Thinking Module (Jules):** The core "worker" agent provided by the **Jules extension**.
-   **Red-Flagging Agent:** A specialized agent/parser that scans outputs for signs of unreliability.
-   **Voting/Composition Discriminators:** Evaluate candidate solutions and aggregate results back up the tree.
-   **GitHub Manager Agent (MCP):** Interfaces with the `github` extension (MCP) for repo management.
-   **User Liaison Agent:** Manages **Iterative Clarification** and **Veto Powers** prompts.

## 6. Risk Assessment & Mitigation
- **Cost & Latency:** Mitigated by `Global Threshold` for confidence.
- **Task Explosion:** Mitigated by `Max Depth` parameter and minimal subtask stop conditions.
- **Red-flagging Accuracy:** Mitigated by combining rule-based and LLM-based parsing.
- **Repo State Drift:** Mitigated by centralized `GitHub Manager Agent` and branch-based composition.
- **HITL Fatigue:** Mitigated by "Event-Driven" prompting logic.

## 7. Success Criteria
- **Error Reduction:** 90% reduction compared to monolithic execution.
- **Decomposition Accuracy:** <1% node failure rate.
- **Voting Consensus:** >80% subtasks reach consensus without veto.
- **Git/GitHub Compliance:** 100% successful git operations.
- **User Satisfaction:** Seamless collaboration without overwhelming prompts.
- **Traceability:** Complete auditable trace in `maker-state.json`.
