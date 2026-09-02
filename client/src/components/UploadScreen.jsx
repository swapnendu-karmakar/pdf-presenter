import { useCallback, useRef, useState } from 'react';

export default function UploadScreen({ onUploaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const uploadFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Please choose a PDF file.');
        return;
      }
      setError('');
      setIsUploading(true);

      const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const clientMeta = {
        sessionId,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      onUploaded(clientMeta, file, sessionId);

      try {
        const formData = new FormData();
        formData.append('pdf', file);
        await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'x-session-id': sessionId,
          },
          body: formData,
        }).catch(() => {});
      } catch {
        /* ignore */
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    uploadFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    uploadFile(file);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f9] px-4 py-12 selection:bg-[#c2e7ff] selection:text-[#001d35]">
      <div className="w-full max-w-lg text-center">
        <div className="rounded-2xl border border-[#dadce0] bg-white p-8 sm:p-10 shadow-sm transition-all">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#f9ab00] text-white shadow-xs">
            <svg className="h-8 w-8 fill-current" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v7H7z" />
            </svg>
          </div>

          <h1 className="text-2xl font-normal text-[#1f1f1f] tracking-tight">
            PDF Slide Presenter
          </h1>
          <p className="mt-1.5 mb-7 text-sm text-[#444746]">
            Upload a presentation PDF to present like Google Slides
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`group cursor-pointer rounded-xl border border-dashed p-8 transition-colors ${
              isDragging
                ? 'border-[#0b57d0] bg-[#edf2fa]'
                : 'border-[#747775]/50 bg-[#f8fafd] hover:border-[#0b57d0] hover:bg-[#f1f3f4]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleChange}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#c2e7ff] border-t-[#0b57d0]" />
                <p className="text-sm font-medium text-[#1f1f1f]">Opening presentation…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf2fa] text-[#0b57d0] group-hover:bg-[#c2e7ff] transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] text-white px-5 py-2 hover:bg-[#0842a0] text-sm font-medium shadow-xs transition active:scale-95"
                  >
                    Select PDF
                  </button>
                  <p className="text-xs text-[#444746] pt-1.5">or drag and drop slide deck here</p>
                  <p className="text-[11px] text-[#747775]">PDF up to 100MB</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#fce8e6] px-3.5 py-2 text-xs font-medium text-[#c5221f]">
              <svg className="h-4 w-4 shrink-0 text-[#c5221f]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
