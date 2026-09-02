import { useEffect, useState } from 'react';
import UploadScreen from './components/UploadScreen';
import Viewer from './components/Viewer';
import Slideshow from './components/Slideshow';
import usePdfDocument from './hooks/usePdfDocument';
import { getPresentation, savePresentation, clearPresentation } from './lib/db';

export default function App() {
  const [status, setStatus] = useState(() => {
    const savedSession = sessionStorage.getItem('pdf_slide_presenter_session');
    return savedSession ? 'checking' : 'empty';
  });
  const [meta, setMeta] = useState(null);
  const [pdfSource, setPdfSource] = useState(null);
  const [slideshowStartPage, setSlideshowStartPage] = useState(null);

  const { doc, numPages, loading: docLoading, progress, error: docError } = usePdfDocument(pdfSource);

  useEffect(() => {
    const savedSession = sessionStorage.getItem('pdf_slide_presenter_session');
    if (!savedSession) return;

    let cancelled = false;

    async function restoreSession() {
      try {
        const stored = await getPresentation(savedSession);
        if (cancelled) return;
        if (stored && stored.blob) {
          setMeta(stored.meta);
          setPdfSource(stored.blob);
          setStatus('ready');
          return;
        }
      } catch {}

      try {
        const res = await fetch('/api/current', {
          headers: { 'x-session-id': savedSession },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.exists && data.sessionId === savedSession) {
            setMeta(data);
            setPdfSource(`/api/pdf?sessionId=${encodeURIComponent(savedSession)}`);
            setStatus('ready');
            return;
          }
        }
      } catch {}

      if (!cancelled) {
        sessionStorage.removeItem('pdf_slide_presenter_session');
        setStatus('empty');
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUploaded = async (data, file, sessionId) => {
    const activeSession = sessionId || data?.sessionId;
    if (activeSession) {
      sessionStorage.setItem('pdf_slide_presenter_session', activeSession);
    }
    setMeta(data);

    if (file) {
      setPdfSource(file);
      if (activeSession) {
        await savePresentation(activeSession, data, file);
      }
    } else if (activeSession) {
      setPdfSource(`/api/pdf?sessionId=${encodeURIComponent(activeSession)}`);
    }
    setStatus('ready');
  };

  const handleReplace = async () => {
    const savedSession = sessionStorage.getItem('pdf_slide_presenter_session') || meta?.sessionId;
    if (savedSession) {
      await clearPresentation(savedSession);
      try {
        await fetch('/api/current', {
          method: 'DELETE',
          headers: { 'x-session-id': savedSession },
        });
      } catch {}
      sessionStorage.removeItem('pdf_slide_presenter_session');
    }
    setMeta(null);
    setPdfSource(null);
    setStatus('empty');
  };

  useEffect(() => {
    const activeSession = meta?.sessionId || sessionStorage.getItem('pdf_slide_presenter_session');
    if (!activeSession || status !== 'ready') return;

    let es = null;
    try {
      es = new EventSource(`/api/session-live?sessionId=${encodeURIComponent(activeSession)}`);
      es.onerror = () => {
        es.close();
      };
    } catch {}

    const handleClose = () => {
      clearPresentation(activeSession);
      try {
        const payload = JSON.stringify({ sessionId: activeSession });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/cleanup', blob);
      } catch {
        fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSession }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', handleClose);
    window.addEventListener('beforeunload', handleClose);

    return () => {
      es?.close();
      window.removeEventListener('pagehide', handleClose);
      window.removeEventListener('beforeunload', handleClose);
    };
  }, [meta?.sessionId, status]);

  const handleStartSlideshow = (startPage) => {
    setSlideshowStartPage(startPage);
  };

  const handleExitSlideshow = () => {
    setSlideshowStartPage(null);
  };

  if (status === 'checking' || (status === 'ready' && (!doc || docLoading))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f4f9] px-4 text-[#1f1f1f] select-none">
        <div className="w-full max-w-sm rounded-2xl border border-[#dadce0] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f9ab00] text-white shadow-xs">
            <svg className="h-7 w-7 fill-current animate-pulse" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v7H7z" />
            </svg>
          </div>

          <h2 className="truncate text-base font-medium text-[#1f1f1f] max-w-full">
            {meta?.originalName || 'Loading presentation…'}
          </h2>
          <p className="mt-0.5 mb-5 text-xs text-[#444746]">
            Preparing slides…
          </p>

          <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8eaed]">
              <div
                className="h-full rounded-full bg-[#0b57d0] transition-all duration-300 ease-out"
                style={{ width: `${Math.max(8, progress || 15)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#747775]">
              <span>{progress >= 100 ? 'Opening' : 'Loading'}</span>
              <span className="font-mono text-[#0b57d0] font-semibold">
                {progress || 15}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return <UploadScreen onUploaded={handleUploaded} />;
  }

  if (docError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center">
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-8 max-w-md shadow-2xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h3 className="mb-1 text-base font-semibold text-white">Failed to load presentation</h3>
          <p className="mb-5 text-sm text-red-300/80">{docError}</p>
          <button
            onClick={handleReplace}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            Upload a different PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Viewer
        meta={meta}
        doc={doc}
        numPages={numPages}
        onReplace={handleReplace}
        onStartSlideshow={handleStartSlideshow}
      />
      {slideshowStartPage && doc && (
        <Slideshow
          doc={doc}
          numPages={numPages}
          startPage={slideshowStartPage}
          onExit={handleExitSlideshow}
        />
      )}
    </>
  );
}
