// public/vad-processor.js
class VADProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const float32Data = input[0];
      // Send the raw audio data back to the main thread (vad.js)
      this.port.postMessage(float32Data);
    }
    return true; // Keep the processor alive
  }
}

registerProcessor('vad-processor', VADProcessor);