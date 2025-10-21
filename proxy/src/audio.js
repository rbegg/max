/**
 * @fileoverview Manages audio playback using the Web Audio API.
 * This module handles creating an AudioContext, playing buffered audio,
 * and managing the mute/unmute state.
 * @author Robert Begg
 * @license MIT
 */

let audioContext;
let gainNode;
let isMuted = true;

function initAudio() {
    if (audioContext) {
        return;
    }
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        // Start muted
        gainNode.gain.value = 0;
    } catch (e) {
        console.error("Web Audio API is not supported in this browser", e);
    }
}

export async function playAudio(arrayBuffer) {
    if (!audioContext || !gainNode) {
        console.warn("Audio context not ready, skipping playback.");
        return;
    }

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);
        source.start(0);
    } catch (error) {
        console.error("Error decoding or playing audio:", error);
    }
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

