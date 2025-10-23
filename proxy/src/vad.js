/**
 * @fileoverview Manages Voice Activity Detection (VAD) using @ricky0123/vad-web.
 * It captures microphone audio and sends it to the server upon speech detection.
 * @author Robert Begg
 * @license MIT
 */

import { MicVAD } from "@ricky0123/vad-web";
import { setVADSpeaking } from './ui.js';

let micVad;

export async function createMicVAD(options) {
    // Get the base URL of the server (e.g., "http://localhost:8080")
    const baseURL = new URL(window.location.origin);
    console.log( '"Base URL: ', baseURL.origin + "/");

    const myVad = await MicVAD.new({
        ...options,
        baseAssetPath: baseURL.origin + "/",
        onnxWASMBasePath: baseURL.origin + "/",
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

