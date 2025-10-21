/**
 * @fileoverview Manages Voice Activity Detection (VAD) using @ricky0123/vad-web.
 * It captures microphone audio and sends it to the server upon speech detection.
 * @author Robert Begg
 * @license MIT
 */

import { setVADSpeaking } from './ui.js';

let micVad;

export async function createMicVAD(options) {
    // Use the imported MicVAD class directly instead of the global 'vad' object
    const myVad = await window.vad.MicVAD.new({
        ...options,
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

