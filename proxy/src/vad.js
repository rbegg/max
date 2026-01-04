/**
 * @fileoverview Manages Voice Activity Detection (VAD) using @ricky0123/vad-web.
 * It captures microphone audio and sends it to the server upon speech detection.
 * @author Robert Begg
 * @license MIT
 */

import { setVADSpeaking } from './ui.js';
import { MicVAD } from "@ricky0123/vad-web";
import * as ort from "onnxruntime-web";

// Tell ONNX Runtime to look for WASM files at the server root
ort.env.wasm.wasmPaths = "/";

// FORCE single-threading to avoid fetching extra .mjs workers in dev
ort.env.wasm.numThreads = 1;

let micVad;

// vad.js
export async function createMicVAD(options) {
    try {
        console.log("Initializing MicVAD with paths:", {
            workletURL: "/vad.worklet.bundle.js",
            modelURL: "/silero_vad.onnx"
        });

        const myVad = await MicVAD.new({
            ...options,
            workletURL: "/vad.worklet.bundle.js",
            modelURL: "/silero_vad.onnx",
            onSpeechStart: () => {
                console.log("Speech started");
                setVADSpeaking(true);
            },
            onSpeechEnd: (audio) => {
                console.log("Speech ended. Sending audio chunk.");
                setVADSpeaking(false);
                if (options.onSpeechEndCallback) {
                    options.onSpeechEndCallback(audio);
                }
            },
        });
        micVad = myVad;
        return myVad;
    } catch (e) {
        // Log the full error object to see the specific failure reason
        console.error("DETAILED VAD ERROR:", e);
        throw e;
    }
}

export function getMicVad() {
    return micVad;
}

export function pauseMicVad() {
    if (micVad) {
        micVad.pause();
        micVad = null;
    }
}

