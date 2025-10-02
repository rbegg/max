/**
 * @fileoverview Manages all UI element interactions and updates for the application.
 *               This includes handling button clicks, updating status messages,
 *               and managing the visual state of indicators.
 * @author Robert Begg
 * @license MIT
 */

export const elements = {
    startButton: document.getElementById('startButton'),
    stopButton: document.getElementById('stopButton'),
    muteButton: document.getElementById('muteButton'),
    statusDiv: document.getElementById('status'),
    vadIndicator: document.getElementById('vad-indicator'),
    transcriptionDiv: document.getElementById('transcription'),
    thresholdInput: document.getElementById('threshold'),
    thresholdValueSpan: document.getElementById('threshold-value'),
    pauseDurationInput: document.getElementById('pause-duration'),
    durationValueSpan: document.getElementById('duration-value'),
};

export function initializeUI(startCb, stopCb, muteCb) {
    elements.startButton.addEventListener('click', startCb);
    elements.stopButton.addEventListener('click', stopCb);
    elements.muteButton.addEventListener('click', muteCb);

    elements.thresholdInput.addEventListener('input', () => {
        elements.thresholdValueSpan.textContent = parseFloat(elements.thresholdInput.value).toFixed(2);
    });

    elements.pauseDurationInput.addEventListener('input', () => {
        elements.durationValueSpan.textContent = `${elements.pauseDurationInput.value} ms`;
    });
}

export function updateStatus(message) {
    elements.statusDiv.textContent = message;
}

export function updateTranscription(text, source) {
    const p = document.createElement('p');
    p.classList.add(`${source}-message`); // Adds 'user-message' or 'llm-message' class

    const prefix = source === 'user' ? '[Me]: ' : '[Max]: ';
    p.textContent = prefix + text;

    elements.transcriptionDiv.prepend(p);
}

export function updateMuteButton(isMuted) {
    elements.muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
    elements.muteButton.classList.toggle('muted', isMuted);
    elements.muteButton.classList.toggle('unmuted', !isMuted);
}

export function setRecordingState(isRecording) {
    elements.startButton.disabled = isRecording;
    elements.stopButton.disabled = !isRecording;
    elements.thresholdInput.disabled = isRecording;
    elements.pauseDurationInput.disabled = isRecording;
    if (isRecording) {
        // Clear previous transcription results
        elements.transcriptionDiv.innerHTML = "";
        elements.vadIndicator.classList.remove('speaking');
    } else {
        elements.vadIndicator.classList.remove('speaking');
    }
}

export function setVADSpeaking(isSpeaking) {
    if (isSpeaking) {
        elements.vadIndicator.classList.add("speaking");
    } else {
        elements.vadIndicator.classList.remove("speaking");
    }
}