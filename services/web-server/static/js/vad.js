import { setVADSpeaking } from './ui.js';

let micVad;

export async function createMicVAD(options) {
    const myVad = await vad.MicVAD.new({
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