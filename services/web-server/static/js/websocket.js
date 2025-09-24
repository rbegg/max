import { updateStatus, updateTranscription } from './ui.js';

let websocket;

function handleWebSocketMessage(event) {
    // Check if the received data is a Blob (binary audio)
    if (event.data instanceof Blob) {
        // Create a URL for the Blob and play the audio
        const audioUrl = URL.createObjectURL(event.data);
        const audio = new Audio(audioUrl);
        audio.play();
        console.log("Played audio response.");
    } else {
        // Otherwise, it's a text message (transcription)
        const transcription = event.data;
        if (transcription) {
            updateTranscription(transcription);
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