const { OpenAI, toFile } = require('openai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');

let conversationHistory = [];
let currentSessionId = null;
let openaiClient = null;
let isInitializingSession = false;
let systemAudioProc = null;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

function initializeNewSession() {
    currentSessionId = Date.now().toString();
    conversationHistory = [];
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function initializeKimiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US') {
    if (isInitializingSession) {
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    try {
        openaiClient = new OpenAI({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
        });

        initializeNewSession();

        const systemPrompt = getSystemPrompt(profile, customPrompt, true);
        conversationHistory.push({ role: 'system', content: systemPrompt });

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Ready');
        return true;
    } catch (error) {
        console.error('Failed to initialize Kimi session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return false;
    }
}

async function sendChatMessage(messageParts) {
    if (!openaiClient) return { success: false, error: 'No active session' };
    try {
        const messages = [...conversationHistory, { role: 'user', content: messageParts }];
        const stream = await openaiClient.chat.completions.create({
            model: 'moonshotai/kimi-k2:free',
            messages,
            stream: true,
        });
        conversationHistory.push({ role: 'user', content: messageParts });
        let responseText = '';
        for await (const chunk of stream) {
            const delta = chunk.choices[0].delta.content || '';
            if (delta) {
                responseText += delta;
                sendToRenderer('update-response', responseText);
            }
        }
        conversationHistory.push({ role: 'assistant', content: responseText });
        sendToRenderer('update-status', 'Listening...');
        return { success: true };
    } catch (error) {
        console.error('Error sending chat message:', error);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return { success: false, error: error.message };
    }
}

async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        return { success: false, error: 'Invalid text message' };
    }
    return sendChatMessage([{ type: 'text', text: text.trim() }]);
}

async function sendImageContent(data) {
    if (!data) return { success: false, error: 'Invalid image data' };
    return sendChatMessage([{ type: 'image_url', image_url: 'data:image/jpeg;base64,' + data }]);
}

async function sendAudioContent({ data, mimeType }) {
    if (!data) return { success: false, error: 'Invalid audio data' };
    try {
        const file = await toFile(Buffer.from(data, 'base64'), 'audio.wav');
        const transcription = await openaiClient.audio.transcriptions.create({ file, model: 'whisper-1' });
        if (transcription.text && transcription.text.trim()) {
            return sendTextMessage(transcription.text);
        }
        return { success: true };
    } catch (error) {
        console.error('Error sending audio:', error);
        return { success: false, error: error.message };
    }
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', () => resolve());
        killProc.on('error', () => resolve());
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture() {
    if (process.platform !== 'darwin') return false;
    await killExistingSystemAudioDump();

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    systemAudioProc = spawn(systemAudioPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (!systemAudioProc.pid) {
        return false;
    }

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);
        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);
            const mono = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = mono.toString('base64');
            sendAudioContent({ data: base64Data, mimeType: 'audio/pcm;rate=24000' });
            if (process.env.DEBUG_AUDIO) {
                saveDebugAudio(mono, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.on('close', () => {
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }
    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

function setupKimiIpcHandlers(kimiSessionRef) {
    global.kimiSessionRef = kimiSessionRef;

    ipcMain.handle('initialize-kimi', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        const success = await initializeKimiSession(apiKey, customPrompt, profile, language);
        if (success) {
            kimiSessionRef.current = true;
        }
        return success;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        return sendAudioContent({ data, mimeType });
    });

    ipcMain.handle('send-image-content', async (event, { data }) => {
        return sendImageContent(data);
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        return sendTextMessage(text);
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture();
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async () => {
        stopMacOSAudioCapture();
        openaiClient = null;
        kimiSessionRef.current = null;
        sendToRenderer('update-status', 'Session closed');
        return { success: true };
    });

    ipcMain.handle('get-current-session', async () => {
        return { success: true, data: getCurrentSessionData() };
    });

    ipcMain.handle('start-new-session', async () => {
        initializeNewSession();
        return { success: true, sessionId: currentSessionId };
    });
}

module.exports = {
    setupKimiIpcHandlers,
    initializeKimiSession,
    startMacOSAudioCapture,
    stopMacOSAudioCapture,
    killExistingSystemAudioDump,
    convertStereoToMono,
};
