/**
 * @fileoverview Manages the WebSocket connection, including sending and receiving messages.
 * It handles text transcription data and binary audio data for playback.
 * @author Robert Begg
 * @license MIT
 */

import { updateStatus, updateTranscription } from './ui.js';
import { playAudio } from './audio.js';

let websocket;

function handleWebSocketMessage(event) {
    // Check if the received data is a Blob (binary audio)
    if (event.data instanceof Blob) {
        // Convert Blob to ArrayBuffer for Web Audio API
        event.data.arrayBuffer().then(arrayBuffer => {
            playAudio(arrayBuffer);
            console.log("Played audio response via Web Audio API.");
        });
    } else {
        // Otherwise, assume it's a text message, potentially JSON
        console.log("Received message:", event.data);
        try {
            const messageData = JSON.parse(event.data);

            // Now you can access properties from your JSON object
            const messageText = messageData.data;

            if (messageText) {
                updateTranscription(messageText, messageData.source);
            }

        } catch (error) {
            // If it's not valid JSON, you could treat it as plain text as a fallback
            console.warn("Received message is not valid JSON, treating as plain text.");
            const transcription = event.data;
            if (transcription) {
                updateTranscription(transcription, true);
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

