export function createEnergyVAD(options) {
    const { 
        onSpeechStart, 
        onSpeechEnd, 
        positiveSpeechThreshold, 
        pauseDurationMs, 
        preSpeechPadMs = 200,
        sampleRate = 16000,
        bufferSize = 4096,
        logLevel = 1, 
        audioPassthrough = true 
    } = options;

    const LOG_LEVELS = { NONE: 0, STANDARD: 1, VERBOSE: 2 };
    const log = (level, ...args) => {
        if (level <= logLevel) console.log(...args);
    };
    const logError = (...args) => console.error(...args);

    let audioContext, mediaStream, scriptProcessor;

    let speechBuffer = [];
    let preSpeechBuffer = [];
    const preSpeechBufferMaxFrames = Math.ceil(preSpeechPadMs / (bufferSize / sampleRate * 1000));
    
    let state = 'silent';
    let silentFramesCount = 0;
    const maxSilentFrames = Math.ceil(pauseDurationMs / (bufferSize / sampleRate * 1000));

    function start() {
        log(LOG_LEVELS.STANDARD, "VAD: Starting...");
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                log(LOG_LEVELS.STANDARD, "VAD: Microphone access granted.");
                mediaStream = stream;
                audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });

                if (audioContext.state === 'suspended') {
                    log(LOG_LEVELS.STANDARD, "VAD: AudioContext is suspended. Resuming...");
                    audioContext.resume().then(() => log(LOG_LEVELS.STANDARD, "VAD: AudioContext resumed successfully."));
                }

                const source = audioContext.createMediaStreamSource(stream);
                scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
                scriptProcessor.onaudioprocess = processAudio;
                source.connect(scriptProcessor);
                scriptProcessor.connect(audioContext.destination);

                if (audioPassthrough) {
                    log(LOG_LEVELS.STANDARD, "VAD: Audio passthrough will be audible.");
                } else {
                    log(LOG_LEVELS.STANDARD, "VAD: Audio passthrough is connected but will be silent.");
                }
                log(LOG_LEVELS.STANDARD, "VAD: Audio processing pipeline set up.");
            })
            .catch(error => {
                logError("VAD: Error accessing microphone:", error);
                throw error;
            });
    }

    function stop() {
        log(LOG_LEVELS.STANDARD, "VAD: Stopping...");
        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
        if (scriptProcessor) scriptProcessor.disconnect();
        if (audioContext) audioContext.close();
        state = 'silent';
        speechBuffer = [];
        preSpeechBuffer = [];
        silentFramesCount = 0;
        log(LOG_LEVELS.STANDARD, "VAD: Stopped and cleaned up.");
    }

    function processAudio(event) {
        if (audioPassthrough) {
            const outputData = event.outputBuffer.getChannelData(0);
            outputData.set(event.inputBuffer.getChannelData(0));
        }

        const inputData = event.inputBuffer.getChannelData(0);
        const energy = calculateRMS(inputData);
        const isSpeech = energy > positiveSpeechThreshold;

        log(LOG_LEVELS.VERBOSE, `VAD: Energy=${energy.toFixed(6)}, Threshold=${positiveSpeechThreshold}, State=${state}`);

        if (state === 'silent') {
            preSpeechBuffer.push(new Float32Array(inputData));
            if (preSpeechBuffer.length > preSpeechBufferMaxFrames) {
                preSpeechBuffer.shift();
            }
        }
        
        if (isSpeech) {
            if (state === 'silent') {
                log(LOG_LEVELS.STANDARD, "VAD: Speech start detected.");
                state = 'speaking';
                speechBuffer.push(...preSpeechBuffer);
                preSpeechBuffer = [];
                speechBuffer.push(new Float32Array(inputData));
                if (onSpeechStart) onSpeechStart();
            } else {
                if (state === 'ending') log(LOG_LEVELS.STANDARD, "VAD: Speech resumed.");
                state = 'speaking';
                speechBuffer.push(new Float32Array(inputData));
                silentFramesCount = 0;
            }
        } else {
            if (state === 'speaking') {
                log(LOG_LEVELS.STANDARD, "VAD: Silence detected, waiting for pause.");
                state = 'ending';
                silentFramesCount = 1;
                speechBuffer.push(new Float32Array(inputData));
            } else if (state === 'ending') {
                silentFramesCount++;
                speechBuffer.push(new Float32Array(inputData));

                if (silentFramesCount >= maxSilentFrames) {
                    log(LOG_LEVELS.STANDARD, `VAD: Pause confirmed after ${silentFramesCount} silent frames.`);
                    const speech = concatenateFloat32Arrays(speechBuffer);
                    speechBuffer = [];
                    state = 'silent';
                    silentFramesCount = 0;

                    log(LOG_LEVELS.STANDARD, "VAD: Calling onSpeechEnd callback.");
                    if (onSpeechEnd) onSpeechEnd(speech);
                }
            }
        }
    }

    function calculateRMS(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        return Math.sqrt(sum / data.length);
    }

    function concatenateFloat32Arrays(arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Float32Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }

    return { start, stop };
}

export function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    const numChannels = 1, bitDepth = 16;
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}