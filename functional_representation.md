# Functional Representation

1. **Session Initialization**
   - User enters an OpenRouter API key.
   - Renderer sends `initialize-kimi` to the main process.
   - Main process establishes a session using `kimi.js`.

2. **Capture Workflow**
   - Renderer captures screen and audio.
   - On macOS, the renderer invokes `start-macos-audio` so the main process spawns **SystemAudioDump** for system sound capture. Capture ends via `stop-macos-audio`.
   - Chunks are sent via IPC (`send-audio-content`, `send-image-content`).
   - Kimi module transcribes audio and forwards content to OpenRouter.

3. **Response Handling**
   - Responses stream back to the renderer through IPC.
   - Conversation history is stored in IndexedDB.
