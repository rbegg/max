/**
 * @fileoverview Manages Voice Activity Detection (VAD) using TEN VAD.
 * It captures microphone audio and sends it to the server upon speech detection.
 * @author Robert Begg
 * @license MIT
 */

import { setVADSpeaking } from './ui.js';
//import createTenVad from '../public/lib/ten_vad.js';
import createTenVad from '/lib/ten_vad.js';
import processorUrl from './vad-processor.js?url';

// HOP_SIZE = 480 (30ms at 16kHz) for better feature context.
const HOP_SIZE = 480;
const SAMPLE_RATE = 16000;
// Smoothing configuration
const PROB_HISTORY_SIZE = 5; // Average over last 5 frames
let probHistory = [];

let vadModule = null;
let vadHandle = null;
let vadHandlePtr = null;
let audioContext = null;
let mediaStream = null;
let isActive = false;
let isSpeaking = false;
let speechBuffer = [];
let silenceFrames = 0;
let options = {};
let workletBuffer = new Float32Array(0);
// Module-level pointers to be reused
let audioPtr = null;
let probPtr = null;
let flagPtr = null;
// Module-level variable to hold the controls
let vadControls = null;

// Helper functions for WASM memory access
function addHelperFunctions() {
    if (!vadModule.getValue) {
        vadModule.getValue = function(ptr, type) {
            const buffer = vadModule.HEAPU8.buffer;
            const view = new DataView(buffer);

            switch (type) {
                case 'i32': return view.getInt32(ptr, true);
                case 'float': return view.getFloat32(ptr, true);
                default: throw new Error(`Unsupported type: ${type}`);
            }
        };
    }

    if (!vadModule.UTF8ToString) {
        vadModule.UTF8ToString = function(ptr) {
            if (!ptr) return '';
            const HEAPU8 = vadModule.HEAPU8;
            let endPtr = ptr;
            while (HEAPU8[endPtr]) ++endPtr;
            const bytes = HEAPU8.subarray(ptr, endPtr);
            return new TextDecoder('utf-8').decode(bytes);
        };
    }
}

// Initialize TEN VAD module
async function initVADModule() {
    if (vadModule) return;

    try {
        console.log("Loading TEN VAD WebAssembly module...");
        vadModule = await createTenVad();
        addHelperFunctions();

        const versionPtr = vadModule._ten_vad_get_version();
        const version = vadModule.UTF8ToString(versionPtr);
        console.log(`TEN VAD loaded successfully. Version: ${version}`);
    } catch (e) {
        console.error("Failed to load TEN VAD module:", e);
        throw e;
    }
}

// Create VAD instance
function createVADInstance(voiceThreshold) {
    try {
        vadHandlePtr = vadModule._malloc(4);
        const result = vadModule._ten_vad_create(vadHandlePtr, HOP_SIZE, voiceThreshold);

        if (result === 0) {
            vadHandle = vadModule.getValue(vadHandlePtr, 'i32');
            // PRE-ALLOCATE processing buffers once
            audioPtr = vadModule._malloc(HOP_SIZE * 2); // 16-bit PCM
            probPtr = vadModule._malloc(4);             // Float32
            flagPtr = vadModule._malloc(4);             // Int32
            console.log("TEN VAD instance created successfully");
            return true;
        } else {
            console.error(`VAD creation failed with code: ${result}`);
            return false;
        }
    } catch (e) {
        console.error("Error creating VAD instance:", e);
        return false;
    }
}

// Destroy VAD instance
function destroyVADInstance() {
    if (vadModule) {
        // 1. Destroy the VAD handle
        if (vadHandle) {
            try { vadModule._ten_vad_destroy(vadHandle); } catch (e) {}
            vadHandle = null;
        }
        // 2. Free the pointer to the handle
        if (vadHandlePtr) {
            try { vadModule._free(vadHandlePtr); } catch (e) {}
            vadHandlePtr = null;
        }
        // 3. Free the shared processing buffers
        [audioPtr, probPtr, flagPtr].forEach(ptr => {
            if (ptr) {
                try { vadModule._free(ptr); } catch (e) {}
            }
        });
        audioPtr = probPtr = flagPtr = null;
    }
}

// Process audio frame through VAD
function processFrame(audioData) {
    if (!vadModule || !vadHandle) return { probability: 0, isVoice: false };

    try {
        // Copy Int16 data to WASM memory
        vadModule.HEAP16.set(audioData, audioPtr / 2);

        const result = vadModule._ten_vad_process(
            vadHandle, audioPtr, HOP_SIZE, probPtr, flagPtr
        );

        if (result === 0) {
            const probability = vadModule.getValue(probPtr, 'float');
            const flag = vadModule.getValue(flagPtr, 'i32');
            return { probability, isVoice: flag === 1 };
        } else {
            console.error(`Frame processing failed with code: ${result}`);
            return { probability: 0, isVoice: false };
        }
    }catch (e) {
        console.error("VAD Process Error:", e);
        return { probability: 0, isVoice: false };
    }
}

// Convert Float32 audio to Int16
// Refactored conversion to prevent clipping
function float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Reduced multiplier from 10.0 to 1.0 to prevent distortion
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

export async function createMicVAD(opts) {
    try {
        options = opts;
        await initVADModule();
        const voiceThreshold = opts.positiveSpeechThreshold || 0.5;
        if (!createVADInstance(voiceThreshold)) {
            throw new Error("Failed to create VAD instance");
        }

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: SAMPLE_RATE, channelCount: 1 }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        // Load and create the Worklet
        // Use the URL Vite generated during the build
        await audioContext.audioWorklet.addModule(processorUrl);
        const source = audioContext.createMediaStreamSource(mediaStream);
        const workletNode = new AudioWorkletNode(audioContext, 'vad-processor');

        // Receive audio from the worklet thread
        workletNode.port.onmessage = (event) => {
            const inputData = event.data;
            const maxVal = Math.max(...inputData);

            // 1. Accumulate incoming 128-sample chunks
                const newBuffer = new Float32Array(workletBuffer.length + inputData.length);
                newBuffer.set(workletBuffer);
                newBuffer.set(inputData, workletBuffer.length);
                workletBuffer = newBuffer;

                // 2. Only process if we have enough for a full HOP_SIZE (256)
                while (workletBuffer.length >= HOP_SIZE) {
                    const frameToProcess = workletBuffer.slice(0, HOP_SIZE);
                    workletBuffer = workletBuffer.slice(HOP_SIZE);

                    const int16Data = float32ToInt16(frameToProcess);
                    const result = processFrame(int16Data);
                    handleVADResult(result, int16Data);
                }
        };

        source.connect(workletNode);
        //workletNode.connect(audioContext.destination);

        // Store controls for websocket.js access
        vadControls = {
            start: () => {
                isActive = true;
                console.log("VAD logic set to ACTIVE"); // Added log for confirmation
            },
            pause: () => {
                isActive = false;
                console.log("VAD logic set to INACTIVE");
            }
        };

        return vadControls;
    } catch (e) {
        console.error("VAD Setup Error:", e);
        throw e;
    }
}


function handleVADResult(result, frame) {
    if (!isActive) return;

    // 2. Implement Moving Average Smoothing
    probHistory.push(result.probability);
    if (probHistory.length > PROB_HISTORY_SIZE) probHistory.shift();

    const avgProbability = probHistory.reduce((a, b) => a + b, 0) / probHistory.length;

    // Use the smoothed average and the threshold from UI
    const threshold = options.positiveSpeechThreshold || 0.5;
    const isActuallySpeaking = avgProbability >= threshold;

    if (isActuallySpeaking) {
        if (!isSpeaking) {
            console.log(`Speech started (Avg Prob: ${avgProbability.toFixed(2)})`);
            isSpeaking = true;
            setVADSpeaking(true);
            speechBuffer = [];
        }
        speechBuffer.push(...frame);
        silenceFrames = 0;
    } else if (isSpeaking) {
        speechBuffer.push(...frame);
        silenceFrames++;

        // Redemption logic remains the same
        const redemptionFrames = options.redemptionFrames || 48;
        if (silenceFrames >= redemptionFrames) {
            console.log("Speech ended.");
            isSpeaking = false;
            setVADSpeaking(false);

            if (options.onSpeechEndCallback && speechBuffer.length > 0) {
                const float32Audio = new Float32Array(speechBuffer.length);
                for (let j = 0; j < speechBuffer.length; j++) {
                    float32Audio[j] = speechBuffer[j] / (speechBuffer[j] < 0 ? 0x8000 : 0x7FFF);
                }
                options.onSpeechEndCallback(float32Audio);
            }
            speechBuffer = [];
            silenceFrames = 0;
            probHistory = []; // Reset history after speech ends
        }
    }
}


export function getMicVad() {
    return vadControls;
}

export function pauseMicVad() {
    isActive = false;
    isSpeaking = false;
    speechBuffer = [];

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    destroyVADInstance();

    vadControls = null;

    console.log("VAD stopped and cleaned up");
}

