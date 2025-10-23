/**
 * @fileoverview Main application logic for the real-time speech transcription client.
 * Initializes the UI, handles recording state, and orchestrates the
 * VAD, WebSocket, and Audio modules.
 * @author Robert Begg
 * @license MIT
 */
// Import the icon files from the assets directory. Vite will process them and provide the correct final URLs.
import faviconICO from './assets/images/favicon.ico';
import faviconPNG16 from './assets/images/max-icon-16x16.png';
import faviconPNG32 from './assets/images/max-icon-32x32.png';
import faviconPNG144 from './assets/images/max-icon-144x144.png';
import appleTouchIcon from './assets/images/max-icon-180x180.png';
import { initAudio} from './audio.js';

// Create and append the link tags for the favicons to the document's head.
// This is the standard way to handle assets in Vite to ensure proper cache-busting.
const icons = [
  { rel: 'icon', type: 'image/x-icon', href: faviconICO },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: faviconPNG16 },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: faviconPNG32 },
  { rel: 'icon', type: 'image/png', sizes: '144x144', href: faviconPNG144 },
  { rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIcon },
];

icons.forEach(iconInfo => {
  const link = document.createElement('link');
  link.rel = iconInfo.rel;
  if (iconInfo.type) link.type = iconInfo.type;
  if (iconInfo.sizes) link.sizes = iconInfo.sizes;
  link.href = iconInfo.href;
  document.head.appendChild(link);
});

import { initializeUI, elements, updateStatus, setRecordingState, updateMuteButton } from './ui.js';
import { connectWebSocket, getWebSocket } from './websocket.js';
import { createMicVAD, pauseMicVad } from './vad.js';
import { toggleMute } from './audio.js';

let isRecording = false;

async function startRecording() {
    if (isRecording) return;
    isRecording = true;
    setRecordingState(true);
    initAudio();

    try {
        const websocket = await connectWebSocket(() => {
            // onClose callback
            if (isRecording) {
                updateStatus('Connection lost. Please try again.');
            }
            stopRecording();
        });

                // Send a test JSON message upon connection
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            const configMessage = {
                type: 'config',
                username: elements.usernameInput.value
            };
            websocket.send(JSON.stringify(configMessage));
            console.log('Sent config JSON message:', configMessage);
        }

        const positiveSpeechThreshold = parseFloat(elements.thresholdInput.value);
        const pauseDurationMs = parseInt(elements.pauseDurationInput.value);
        const redemptionFrames = Math.round(pauseDurationMs / 32);

        console.log(`VAD settings: Threshold=${positiveSpeechThreshold}, Redemption Frames=${redemptionFrames}`);

        const myVad = await createMicVAD({
            positiveSpeechThreshold: positiveSpeechThreshold,
            redemptionFrames: redemptionFrames,
            onSpeechEndCallback: (audio) => {
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    const flt32Blob = new Blob([audio.buffer], { type: 'application/octet-stream' });
                    websocket.send(flt32Blob);
                }
            }
        });
        myVad.start();

    } catch (error) {
        console.error('Error starting recording:', error);
        updateStatus(`Error: ${error.message}`);
        stopRecording();
    }
}

function stopRecording() {
    if (!isRecording) return;
    isRecording = false;

    pauseMicVad();

    const websocket = getWebSocket();
    if (websocket) {
        websocket.close();
    }

    setRecordingState(false);
    updateStatus('Recording stopped. Press Start to begin again.');
}

function handleMuteClick() {
    const isMuted = toggleMute();
    updateMuteButton(isMuted);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUI(startRecording, stopRecording, handleMuteClick);
    setRecordingState(false); // Initial state
    updateMuteButton(false); // Set initial mute state on UI
});

