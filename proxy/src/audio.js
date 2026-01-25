/**
 * @fileoverview Manages audio playback using the Web Audio API.
 * This module handles creating an AudioContext, playing buffered audio,
 * and managing the mute/unmute state.
 * @author Robert Begg
 * @license MIT
 */

let audioContext;
let gainNode;
let prevSource = null;
let isMuted = false;

export function initAudio() {
    console.log("***Init AudioContext***")
    if (!audioContext) {
        try {
            // Force 44.1kHz to match iOS hardware and avoid resampling crashes
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass({ sampleRate: 44100 });
            console.log("Init AudioContext: Set Sample Rate")

            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);

            audioContext.onstatechange = () => {
                console.log("AudioContext state change:", audioContext.state);

                // If iOS interrupts the app (phone call, alarm, etc.),
                // we attempt to resume once the interruption ends.
                if (audioContext.state === 'interrupted' || audioContext.state === 'suspended') {
                    console.log("Attempting to resume interrupted audio context...");
                    audioContext.resume().catch(err => console.error("Resume failed:", err));
                }
            };
        } catch (e) {
            console.error("Web Audio API is not supported in this browser", e);
        }
    }
    // Crucial for iOS: resume() must be called inside a user-initiated event
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

export function playAudio(arrayBuffer) {
    return new Promise((resolve, reject) => {
        if (!audioContext || !gainNode) {
            console.warn("Audio context not ready.");
            return resolve();
        }

        audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            const source = audioContext.createBufferSource();
            if (prevSource) {
                try { prevSource.stop();
                      prevSource.disconnect(); // CRITICAL: Free memory
                } catch(e) {}
            }

            source.buffer = audioBuffer;
            source.connect(gainNode);

            // Resolve the promise when the audio finishes playing
            source.onended = () => {
                source.disconnect(); // CRITICAL: Release the node after playback
                resolve();
            };

            source.start(0);
            prevSource = source;
        }, (error) => {
            console.error("Error decoding audio:", error);
            reject(error);
        });
    });
}

export function toggleMute() {
    // Initialize audio context on first user interaction (the mute button click)
    initAudio();

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    isMuted = !isMuted;

    if (gainNode) {
        // Smoothly transition the gain to avoid clicks
        gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext.currentTime);
    }
    return isMuted;
}

