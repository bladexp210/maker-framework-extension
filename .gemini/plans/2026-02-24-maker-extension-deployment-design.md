# Design Document: MAKER Framework Extension Deployment
**Date:** February 24, 2026
**Slug:** maker-extension-deployment
**Status:** Approved

## 1. Problem Statement
The objective is to deploy the newly developed `maker-framework` Gemini CLI extension to a public GitHub repository, making it installable for other users via the standard `gemini extensions install <URL>` command. Currently, the user's `github` extension is experiencing an authentication failure.

## 2. Requirements

### Functional Requirements
- **Extension Authentication:** Successfully authenticate the `github` MCP server using a Personal Access Token (PAT).
- **Repository Creation:** Create a new, public GitHub repository named `maker-framework-extension`.
- **Code Deployment:** Push the contents of the `/home/mohamed/Projects/maker-framework` directory.
- **Installability:** Ensure the repository contains a valid `package.json` and `gemini-extension.json`.

### Non-Functional Requirements
- **Security:** Handle PAT securely.
- **Reliability:** Verify successful creation and push.
- **Observability:** Provide clear logs.

## 3. Approach

### Selected Approach: GitHub Extension-Managed Deployment
A fully integrated approach using the `github` Gemini extension for all repository management tasks, from creation to code push.

**Workflow**:
1.  **Authentication Remediation:** Correctly set the `GITHUB_PERSONAL_ACCESS_TOKEN`.
2.  **Repository Creation:** Use `github:create-repository` to create the repo.
3.  **Initial Push:** Commit and push the local source code.
4.  **Verification:** Confirm the repository is installable.

## 4. Architecture

### Component Diagram
```mermaid
graph TD
    A[Gemini CLI] --> B[MAKER Extension (Node.js/TS)]
    B --> C[GitHub MCP Server Bridge]
    C --> D[GitHub API]
    B --> E[User Interaction Module]
    B --> F[Authentication Handler]
    F --> G[GITHUB_PERSONAL_ACCESS_TOKEN]
```

### Key Interfaces
- `IGithubRepo`: Name, description, visibility, URL.
- `IGithubFile`: Path, content, message.
- `IAuthStatus`: isAuthenticated, user, error.

## 5. Agent Team
- **Architect**: Strategy and installation compliance.
- **DevOps Engineer**: Auth remediation and repo management.
- **Technical Writer**: README and metadata polishing.
- **Code Reviewer**: Final quality gate.

## 6. Risk Assessment & Mitigation
- **Auth Failure**: Fall back to local `git` if MCP remains unreachable.
- **Partial Push**: Use `deployment-state.json` to track and resume.
- **Token Exposure**: Use environment variables and strict ignore policies.
- **Installability**: Pre-deployment check of `package.json` and `gemini-extension.json`.

## 7. Success Criteria
- **Quantitative**: 100% file integrity, successful repo creation, zero auth errors.
- **Qualitative**: Installable via `gemini extensions install <URL>`, polished documentation.
