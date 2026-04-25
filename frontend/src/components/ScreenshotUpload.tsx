import { useState, useRef } from 'react';
import type { ExtractionResult } from '../../../shared/index';

interface ScreenshotUploadProps {
  onSuccess: (result: ExtractionResult) => void;
  onFallback: () => void; // User clicks "Enter manually instead"
  isLoading?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export default function ScreenshotUpload({
  onSuccess,
  onFallback,
  isLoading = false,
}: ScreenshotUploadProps) {
  const [uploadState, setUploadState] = useState<
    | { status: 'idle' }
    | { status: 'uploading' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // ─── File validation ───────────────────────────────────────────────────────
  function validateFile(file: File): { valid: boolean; error?: string } {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type. Accepted: PNG, JPG, WEBP.`,
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File too large. Maximum size is 4MB.`,
      };
    }

    return { valid: true };
  }

  // ─── Upload handler ───────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    const validation = validateFile(file);
    if (!validation.valid) {
      setUploadState({
        status: 'error',
        message: validation.error || 'Invalid file',
      });
      return;
    }

    setUploadState({ status: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/extract/holdings', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || 'We couldn\'t read this screenshot — try a clearer image or enter manually';
        setUploadState({
          status: 'error',
          message: errorMsg,
        });
        return;
      }

      const result: ExtractionResult = await response.json();
      setUploadState({ status: 'idle' });
      onSuccess(result);
    } catch (err) {
      setUploadState({
        status: 'error',
        message: 'We couldn\'t read this screenshot — try a clearer image or enter manually',
      });
    }
  }

  // ─── Event handlers ───────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input so selecting the same file twice triggers change event
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }

  const isActive = uploadState.status === 'uploading' || isLoading;
  const hasError = uploadState.status === 'error';

  return (
    <div style={{ marginBottom: 'var(--sp-6)' }}>
      {/* ─── Privacy notice ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--color-brand-surface)',
          border: '1.5px solid var(--color-brand-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-3) var(--sp-4)',
          marginBottom: 'var(--sp-4)',
          display: 'flex',
          gap: 'var(--sp-3)',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: '1.2rem', flexShrink: 0, lineHeight: 1 }}>🔒</span>
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
          margin: 0,
        }}>
          Your screenshot is sent to Google's Gemini API for processing and is not stored by us.
        </p>
      </div>

      {/* ─── Upload dropzone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: 'var(--color-bg)',
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-6)',
          textAlign: 'center',
          cursor: isActive ? 'default' : 'pointer',
          transition: 'all var(--transition-fast)',
          opacity: isActive ? 0.6 : 1,
          pointerEvents: isActive ? 'none' : 'auto',
        }}
      >
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <span style={{
            display: 'inline-block',
            fontSize: '2.5rem',
            lineHeight: 1,
          }}>
            {isActive ? '⏳' : '📷'}
          </span>
        </div>

        {isActive ? (
          <>
            <p style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--sp-1) 0',
            }}>
              Extracting holdings…
            </p>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}>
              This may take a few seconds
            </p>
          </>
        ) : (
          <>
            <p style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--sp-1) 0',
            }}>
              Upload a screenshot of your portfolio
            </p>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--sp-2) 0',
            }}>
              We'll extract your holdings automatically.
            </p>

            {/* ─── Hidden file input ────────────────────────────────────────── */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              disabled={isActive}
              style={{ display: 'none' }}
              aria-hidden="true"
            />

            {/* ─── Choose file button ───────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isActive}
              style={{
                display: 'inline-block',
                background: 'var(--color-brand)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-2) var(--sp-4)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isActive ? 'not-allowed' : 'pointer',
                opacity: isActive ? 0.5 : 1,
                transition: 'background var(--transition-fast)',
                marginRight: 'var(--sp-2)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-hover)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand)';
              }}
            >
              Choose File
            </button>

            <span style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              display: 'inline-block',
            }}>
              or drag and drop
            </span>

            {/* ─── File type hint ────────────────────────────────────────────── */}
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              margin: 'var(--sp-2) 0 0 0',
              lineHeight: 1.4,
            }}>
              PNG, JPG or WEBP · Max 4MB
            </p>
          </>
        )}
      </div>

      {/* ─── Error message ───────────────────────────────────────────────────── */}
      {hasError && (
        <div style={{
          background: 'var(--color-error-bg)',
          border: '1.5px solid var(--color-error-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-3) var(--sp-4)',
          marginTop: 'var(--sp-3)',
          marginBottom: 'var(--sp-2)',
          display: 'flex',
          gap: 'var(--sp-2)',
          alignItems: 'flex-start',
        }}>
          <span style={{
            fontSize: '1rem',
            flexShrink: 0,
            lineHeight: 1,
          }}>
            ⚠️
          </span>
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--color-trailing)',
            margin: 0,
            fontWeight: 500,
          }}>
            {uploadState.status === 'error' ? uploadState.message : ''}
          </p>
        </div>
      )}

      {/* ─── Fallback link ────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: 'var(--sp-3)' }}>
        <p style={{
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          margin: '0 0 var(--sp-2) 0',
        }}>
          — or —
        </p>
        <button
          type="button"
          onClick={onFallback}
          disabled={isActive}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-brand)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: isActive ? 'not-allowed' : 'pointer',
            opacity: isActive ? 0.5 : 1,
            textDecoration: 'none',
            padding: 0,
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand-hover)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-brand)';
          }}
        >
          Enter manually instead
        </button>
      </div>
    </div>
  );
}
