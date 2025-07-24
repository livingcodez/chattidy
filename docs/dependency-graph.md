# Dependency Graph

The application is built with Electron 30 and Node.js. The front end uses LitElement web components. AI features are provided by the `openai` package pointed to the OpenRouter API. Other notable dependencies include:

- `electron-squirrel-startup` – Windows install helper
- `@electron-forge/*` – packaging utilities

```
CheatingDaddyApp -> renderer utilities -> IPC -> main process -> kimi.js -> OpenRouter API
```
