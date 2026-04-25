#!/usr/bin/env node

/**
 * Quick test for POST /api/extract/holdings
 * Uses a fake PNG image for testing
 */

import fs from 'fs';
import path from 'path';

// Create a minimal valid PNG (1x1 pixel, white)
// PNG signature + IHDR chunk + IDAT chunk + IEND chunk
const pngBuffer = Buffer.from([
  // PNG signature
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // IHDR chunk (13 bytes data)
  0x00, 0x00, 0x00, 0x0d, // Length
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x01, // Width: 1
  0x00, 0x00, 0x00, 0x01, // Height: 1
  0x08, 0x02,             // Bit depth: 8, Color type: 2 (RGB)
  0x00, 0x00, 0x00,       // Compression, filter, interlace
  0x90, 0x77, 0x53, 0xde, // CRC
  // IDAT chunk (10 bytes data - minimal white pixel)
  0x00, 0x00, 0x00, 0x0a, // Length
  0x49, 0x44, 0x41, 0x54, // "IDAT"
  0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01, 0x00, 0x02,
  0xc8, 0xaf, 0xa4, 0x6c, // CRC
  // IEND chunk (0 bytes data)
  0x00, 0x00, 0x00, 0x00, // Length
  0x49, 0x45, 0x4e, 0x44, // "IEND"
  0xae, 0x42, 0x60, 0x82  // CRC
]);

const base64Image = pngBuffer.toString('base64');

console.log('PNG image created (1x1 pixel)');
console.log('Base64 length:', base64Image.length);

// Test payload
const testPayload = {
  imageBase64: base64Image,
  mimeType: 'image/png'
};

console.log('\nTest payload:');
console.log(JSON.stringify(testPayload, null, 2).slice(0, 200) + '...');

// Save for reference
fs.writeFileSync('/tmp/test-extract-payload.json', JSON.stringify(testPayload, null, 2));
console.log('\nSaved to /tmp/test-extract-payload.json');
