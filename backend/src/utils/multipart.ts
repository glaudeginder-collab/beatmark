/**
 * Multipart Form Data Parser
 *
 * Simple parser for multipart/form-data requests (file uploads).
 * Used by the extraction endpoint to read image files.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest } from '@vercel/node';

export interface ParsedMultipart {
  imageBuffer: Buffer;
  mimeType: string;
}

/**
 * Parse multipart/form-data from a Vercel request.
 *
 * Expects a single 'image' field containing the file.
 *
 * @param req - Vercel request object
 * @returns Parsed image buffer and MIME type
 * @throws If parsing fails
 */
export async function parseMultipartBody(req: VercelRequest): Promise<ParsedMultipart> {
  // Get the boundary from Content-Type header
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    throw new Error('No boundary found in Content-Type header');
  }

  const boundary = boundaryMatch[1];

  // Get the raw body
  let body: Buffer;
  if (Buffer.isBuffer(req.body)) {
    body = req.body;
  } else if (typeof req.body === 'string') {
    body = Buffer.from(req.body);
  } else {
    throw new Error('Invalid request body type');
  }

  // Parse the multipart body
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  
  let currentPos = 0;
  let boundaryPos = body.indexOf(boundaryBytes);
  
  while (boundaryPos !== -1) {
    if (currentPos < boundaryPos) {
      parts.push(body.slice(currentPos, boundaryPos));
    }
    currentPos = boundaryPos + boundaryBytes.length;
    boundaryPos = body.indexOf(boundaryBytes, currentPos);
  }
  
  if (currentPos < body.length) {
    parts.push(body.slice(currentPos));
  }

  for (const part of parts) {
    if (part.length < 4) continue; // Skip empty parts

    // Find the double CRLF that separates headers from body
    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;

    const headerSection = part.slice(0, headerEndIndex).toString('utf-8');

    // Check if this part contains the 'image' field
    if (!headerSection.includes('name="image"')) {
      continue;
    }

    // Extract MIME type from Content-Type header
    const mimeTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
    if (!mimeTypeMatch) {
      throw new Error('No Content-Type in image field');
    }

    const mimeType = mimeTypeMatch[1].trim();

    // Extract the actual file data (skip the CRLF after headers)
    let fileData = part.slice(headerEndIndex + 4);

    // Remove trailing CRLF and closing boundary marker if present
    if (fileData.slice(-2).toString() === '\r\n') {
      fileData = fileData.slice(0, -2);
    }

    return {
      imageBuffer: fileData,
      mimeType,
    };
  }

  throw new Error('No image field found in multipart body');
}
