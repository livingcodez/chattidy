# Functional Representation

This document outlines the functional components of the Cheating Daddy application.

## Core Components

-   **`CheatingDaddyApp`**: The main application component that manages the current view and application state.
-   **`AppHeader`**: The application header, which displays the current view, status, and provides navigation controls.
-   **`MainView`**: The main view of the application, which allows the user to start a new session.
-   **`CustomizeView`**: The view that allows the user to customize the application settings, including the selected profile, language, and other options.
-   **`HelpView`**: The view that provides help and support information.
-   **`HistoryView`**: The view that displays the user's conversation history.
-   **`AssistantView`**: The view that displays the real-time AI assistance.
-   **`OnboardingView`**: The view that guides the user through the initial setup process.
-   **`AdvancedView`**: The view that provides advanced configuration options.

## Utility Modules

-   **`prompts.js`**: A module that provides the system prompts for the different AI profiles.
-   **`gemini.js`**: A module that provides a wrapper around the Gemini API.
-   **`window.js`**: A module that provides functions for managing the application window.
-   **`windowResize.js`**: A module that provides functions for resizing the application window.

## New Features

### Colleague Profile

The new "Colleague" profile provides a professional and collaborative AI assistant. It is designed to provide helpful, constructive, and insightful feedback on ideas, documents, and other work-related materials.

### Timestamp Validation

The application now stores conversation turns with `timestamp` and `formattedTimestamp` fields. The `HistoryView` component displays the timestamps only when the `formattedTimestamp` is a valid HH:MM:SS timestamp. This ensures that only valid timestamps are displayed to the user.
