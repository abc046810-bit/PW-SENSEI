import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

console.log('🚀 Building static assets for production deployment...');

if (!fs.existsSync(srcDir)) {
  console.error('❌ Source directory "public" not found.');
  process.exit(1);
}

// Clean and recreate dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy all public files into dist recursively
fs.cpSync(srcDir, distDir, { recursive: true });

console.log('✅ Successfully populated output directory: "dist"');
console.log(`📁 Copied files from ${srcDir} to ${distDir}`);
