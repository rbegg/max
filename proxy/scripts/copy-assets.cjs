const fs = require('fs');
const path = require('path');

console.log('Copying VAD assets for build source and dev server...');

const assetsToCopy = [
  // 1. Copy ONNX model to src/ (for dev server work-around AND as source for viteStaticCopy)
  {
    srcDir: path.resolve(__dirname, '../node_modules/@ricky0123/vad-web/dist'),
    destDir: path.resolve(__dirname, '../src'), // Destination is src/
    files: ['silero_vad.onnx'],
  },
  // 2. Copy Worklet JS bundle to public/ (loaded explicitly via root URL)
  {
    srcDir: path.resolve(__dirname, '../node_modules/@ricky0123/vad-web/dist'),
    destDir: path.resolve(__dirname, '../src'), // Destination is public/
    files: ['vad.worklet.bundle.min.js'],
  },
  // 3. REMOVED: WASM/MJS files are now handled by vite-plugin-static-copy during build
];

// Ensure destination directories exist
assetsToCopy.forEach(group => {
  if (!fs.existsSync(group.destDir)) {
    console.log(`Creating destination directory: ${group.destDir}`);
    fs.mkdirSync(group.destDir, { recursive: true });
  }
});

// Perform the copy operations
assetsToCopy.forEach(group => {
  group.files.forEach(fileName => {
    const srcPath = path.join(group.srcDir, fileName);
    const destPath = path.join(group.destDir, fileName);

    if (fs.existsSync(srcPath)) {
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${fileName} to ${group.destDir}`);
      } catch (err) {
        console.error(`Error copying ${fileName}:`, err);
      }
    } else {
      console.warn(`Source file not found, skipping: ${srcPath}`);
    }
  });
});

console.log('Asset copying complete.');

