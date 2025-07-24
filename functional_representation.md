# Functional Representation

1. **Session Initialization**
   - User enters an OpenRouter API key.
   - Renderer sends `initialize-kimi` to the main process.
   - Main process establishes a session using `kimi.js`.

2. **Capture Workflow**
   - Renderer captures screen and audio.
   - Renderer invokes `start-macos-audio` to spawn SystemAudioDump on macOS.
   - Chunks are sent via IPC (`send-audio-content`, `send-image-content`).
   - Capture ends with `stop-macos-audio`.
   - Kimi module transcribes audio and forwards content to OpenRouter.

3. **Response Handling**
   - Responses stream back to the renderer through IPC.
   - Conversation history is stored in IndexedDB.
