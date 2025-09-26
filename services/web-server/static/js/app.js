import { initializeUI, elements, updateStatus, setRecordingState } from './ui.js';
import { connectWebSocket, getWebSocket } from './websocket.js';
import { createEnergyVAD, encodeWAV } from './vad.js';

let isRecording = false;
let myVad = null;
const sampleRate = 16000;

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
        const preSpeechPadMs = parseInt(elements.preSpeechPadInput.value, 10);
        const bufferSize = parseInt(document.querySelector('input[name="buffer-size"]:checked').value, 10);
        
        // Get debug settings
        const logLevel = parseInt(elements.logLevelSelect.value, 10);
        const audioPassthrough = elements.audioPassthroughCheckbox.checked;

        console.log(`APP: VAD settings: Threshold=${positiveSpeechThreshold}, Pause Duration=${pauseDurationMs}ms, Pre-speech Padding=${preSpeechPadMs}ms, Buffer Size=${bufferSize}`);
        console.log(`APP: Debug settings: Log Level=${logLevel}, Audio Passthrough=${audioPassthrough}`);

        const vadIndicator = document.getElementById('vad-indicator');

        myVad = createEnergyVAD({
            positiveSpeechThreshold: positiveSpeechThreshold,
            pauseDurationMs: pauseDurationMs,
            preSpeechPadMs: preSpeechPadMs,
            sampleRate: sampleRate,
            bufferSize: bufferSize,
            logLevel: logLevel,
            audioPassthrough: audioPassthrough,
            onSpeechStart: () => {
                console.log("APP: onSpeechStart triggered.");
                vadIndicator.style.backgroundColor = 'green';
            },
            onSpeechEnd: (audio) => {
                console.log(`APP: onSpeechEnd triggered with audio data of length ${audio.length}.`);
                vadIndicator.style.backgroundColor = '#ddd';
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    console.log("APP: WebSocket is open. Encoding audio to WAV.");
                    const wavBuffer = encodeWAV(audio, sampleRate);
                    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
                    console.log(`APP: Sending WAV data of size ${wavBlob.size} bytes.`);
                    websocket.send(wavBlob);
                } else {
                    console.warn("APP: onSpeechEnd called, but WebSocket is not open. State:", websocket ? websocket.readyState : 'null');
                }
            }
        });
        myVad.start();
        updateStatus('Recording...');

    } catch (error) {
        console.error('APP: Error starting recording:', error);
        updateStatus(`Error: ${error.message}`);
        stopRecording();
    }
}

function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    console.log("APP: stopRecording called.");

    if (myVad) {
        myVad.stop();
        myVad = null;
    }

    const websocket = getWebSocket();
    if (websocket) {
        console.log("APP: Closing WebSocket.");
        websocket.close();
    }
    
    const vadIndicator = document.getElementById('vad-indicator');
    if (vadIndicator) {
        vadIndicator.style.backgroundColor = '#ddd';
    }

    setRecordingState(false);
    updateStatus('Recording stopped. Press Start to begin again.');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUI(startRecording, stopRecording);
    setRecordingState(false); // Initial state
});