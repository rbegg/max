import { initializeUI, elements, updateStatus, setRecordingState } from './ui.js';
import { connectWebSocket, getWebSocket } from './websocket.js';
import { createMicVAD, pauseMicVad } from './vad.js';

let isRecording = false;

async function startRecording() {
    if (isRecording) return;
    isRecording = true;
    setRecordingState(true);

    try {
        const websocket = await connectWebSocket(() => {
            // onClose callback
            if (isRecording) {
                updateStatus('Connection lost. Please try again.');
            }
            stopRecording();
        });

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

document.addEventListener('DOMContentLoaded', () => {
    initializeUI(startRecording, stopRecording);
    setRecordingState(false); // Initial state
});