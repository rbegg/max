/**
 * @fileoverview Manages the WebSocket connection, including sending and receiving messages.
 * It handles text transcription data and binary audio data for playback.
 * @author Robert Begg
 * @license MIT
 */

import { updateStatus, updateTranscription } from './ui.js';
import { playAudio } from './audio.js';
import { getMicVad } from './vad.js'; // Ensure this is exported in vad.js

let websocket;

async function handleWebSocketMessage(event) {
    // Check if the received data is a Blob (binary audio)
    if (event.data instanceof Blob) {
        const micVad = getMicVad();

        try {
            // 1. Pause VAD to release the microphone lock and prevent iOS contention
            if (micVad) {
                micVad.pause();
                console.log("VAD paused for playback.");
            }

            // 2. Convert Blob to ArrayBuffer
            const arrayBuffer = await event.data.arrayBuffer();

            // 3. Play the audio and wait for it to finish
            // Note: playAudio should return a Promise that resolves when playback ends
            await playAudio(arrayBuffer);
            console.log("Audio playback finished.");

        } catch (error) {
            console.error("Error during audio handling:", error);
        } finally {
            // 4. Resume VAD so the user can speak again
            if (micVad && micVad.state !== 'destroyed') {
                micVad.start();
                console.log("VAD resumed.");
            }
        }

    } else {
        // Handle text/JSON messages
        console.log("Received message:", event.data);
        try {
            const messageData = JSON.parse(event.data);
            const messageText = messageData.data;

            if (messageText) {
                updateTranscription(messageText, messageData.source);
            }
        } catch (error) {
            console.warn("Received message is not valid JSON, treating as plain text.");
            const transcription = event.data;
            if (transcription) {
                updateTranscription(transcription, 'llm');
            }
        }
    }
}

export function connectWebSocket(onCloseCallback) {
    return new Promise((resolve, reject) => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        updateStatus(`Connecting to server at ${wsUrl}...`);
        console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);

        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log('WebSocket connection established.');
            updateStatus('Connected. Speak into your microphone.');
            resolve(websocket);
        };

        websocket.onmessage = handleWebSocketMessage;

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('Error connecting to the server.');
            reject(error);
        };

        websocket.onclose = () => {
            console.log('WebSocket connection closed.');
            if (onCloseCallback) {
                onCloseCallback();
            }
        };
    });
}

export function getWebSocket() {
    return websocket;
}

