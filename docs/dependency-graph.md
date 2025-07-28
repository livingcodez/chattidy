# Dependency Graph

This document lists major file relationships in the project.

- `src/components/*` depend on `src/utils/*` for core logic.
- `src/utils/gemini.js` interacts with Google Gemini and dispatches events to renderer.
- Conversation data flows from `gemini.js` to renderer via IPC and is stored using functions in `src/utils/renderer.js`.
