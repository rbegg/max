export const elements = {
    startButton: document.getElementById('startButton'),
    stopButton: document.getElementById('stopButton'),
    statusDiv: document.getElementById('status'),
    transcriptionDiv: document.getElementById('transcription'),
    vadIndicator: document.getElementById('vad-indicator'),
    
    // VAD Settings
    thresholdInput: document.getElementById('threshold'),
    thresholdValueSpan: document.getElementById('threshold-value'),
    pauseDurationInput: document.getElementById('pause-duration'),
    durationValueSpan: document.getElementById('duration-value'),
    preSpeechPadInput: document.getElementById('pre-speech-pad'),
    preSpeechPadValue: document.getElementById('pre-speech-pad-value'),
    bufferSizeRadios: document.querySelectorAll('input[name="buffer-size"]'),

    // Debug Settings
    logLevelSelect: document.getElementById('log-level'),
    audioPassthroughCheckbox: document.getElementById('audio-passthrough'),
};

export function initializeUI(startCb, stopCb) {
    elements.startButton.addEventListener('click', startCb);
    elements.stopButton.addEventListener('click', stopCb);

    elements.thresholdInput.addEventListener('input', () => {
        elements.thresholdValueSpan.textContent = parseFloat(elements.thresholdInput.value).toFixed(3);
    });

    elements.pauseDurationInput.addEventListener('input', () => {
        elements.durationValueSpan.textContent = `${elements.pauseDurationInput.value} ms`;
    });

    elements.preSpeechPadInput.addEventListener('input', () => {
        elements.preSpeechPadValue.textContent = `${elements.preSpeechPadInput.value} ms`;
    });
}

export function updateStatus(message) {
    elements.statusDiv.textContent = message;
}

export function updateTranscription(text) {
    const p = elements.transcriptionDiv.querySelector('p');
    p.textContent = text;
}

export function setRecordingState(isRecording) {
    elements.startButton.disabled = isRecording;
    elements.stopButton.disabled = !isRecording;

    // Disable all settings during recording
    elements.thresholdInput.disabled = isRecording;
    elements.pauseDurationInput.disabled = isRecording;
    elements.preSpeechPadInput.disabled = isRecording;
    elements.bufferSizeRadios.forEach(radio => radio.disabled = isRecording);
    elements.logLevelSelect.disabled = isRecording;
    elements.audioPassthroughCheckbox.disabled = isRecording;

    if (isRecording) {
        updateTranscription("");
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