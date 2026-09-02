import { useCallback, useEffect, useRef, useState } from 'react';
import PdfPageCanvas from './PdfPageCanvas';
import ErrorBoundary from './ErrorBoundary';

export default function Slideshow({ doc, numPages, startPage, onExit }) {
  const [currentPage, setCurrentPage] = useState(startPage || 1);
  const [viewportSize, setViewportSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [slideDimensions, setSlideDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [scaleMode, setScaleMode] = useState('fit');
  const [showHint, setShowHint] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const containerRef = useRef(null);
  const idleTimerRef = useRef(null);

  const goTo = useCallback(
    (n) => setCurrentPage(() => Math.min(Math.max(n, 1), numPages || 1)),
    [numPages]
  );
  const goNext = useCallback(() => goTo(currentPage + 1), [currentPage, goTo]);
  const goPrev = useCallback(() => goTo(currentPage - 1), [currentPage, goTo]);

  const handleMouseMove = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    el?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      handleMouseMove();
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        e.key === ' ' ||
        e.key === 'Enter'
      ) {
        e.preventDefault();
        goNext();
      } else if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp'
      ) {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === 'f' || e.key === 'F') {
        setScaleMode((m) => (m === 'fit' ? 'fill' : 'fit'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onExit, handleMouseMove]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [onExit]);

  useEffect(() => {
    if (!doc || doc.destroyed) return;
    let cancelled = false;

    try {
      const pagePromise = doc.getPage(currentPage);
      if (!pagePromise || typeof pagePromise.then !== 'function') return;

      pagePromise
        .then((page) => {
          if (cancelled || doc.destroyed) return;
          const vp = page.getViewport({ scale: 1 });
          const aspect = vp.width / vp.height;
          const { w, h } = viewportSize;

          let targetW;
          if (scaleMode === 'fill') {
            targetW = Math.max(w, h * aspect);
          } else {
            targetW = Math.min(w, h * aspect);
          }

          setSlideDimensions({
            width: Math.round(targetW),
            height: Math.round(targetW / aspect),
          });
        })
        .catch(() => {});
    } catch {}

    return () => {
      cancelled = true;
    };
  }, [doc, currentPage, viewportSize, scaleMode]);

  const handleClick = (e) => {
    if (e.target.closest('button')) return;
    const { left, width: w } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    if (x < w * 0.3) goPrev();
    else goNext();
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none ${
        controlsVisible ? 'cursor-default' : 'cursor-none'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <ErrorBoundary>
          <PdfPageCanvas
            doc={doc}
            pageNumber={currentPage}
            targetWidth={slideDimensions.width}
          />
        </ErrorBoundary>
      </div>

      <div
        className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setScaleMode((m) => (m === 'fit' ? 'fill' : 'fit'));
          }}
          title={scaleMode === 'fit' ? 'Fill screen (no letterboxing)' : 'Fit to screen'}
          className="rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md border border-slate-700/60 hover:bg-slate-800 hover:text-white transition"
        >
          {scaleMode === 'fit' ? 'Fit' : 'Fill'}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          aria-label="Exit slideshow"
          className="rounded-full bg-slate-900/80 p-2 text-slate-300 backdrop-blur-md border border-slate-700/60 transition hover:bg-slate-800 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${
          controlsVisible && currentPage > 1
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous slide"
          className="rounded-full bg-black/60 p-3 text-white/80 backdrop-blur-md border border-white/10 hover:bg-black/90 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <div
        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${
          controlsVisible && currentPage < numPages
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next slide"
          className="rounded-full bg-black/60 p-3 text-white/80 backdrop-blur-md border border-white/10 hover:bg-black/90 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-3.5 py-1 text-xs font-medium text-slate-300 backdrop-blur-md border border-slate-700/60 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {currentPage} / {numPages}
      </div>

      {showHint && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900/90 px-4 py-2 text-xs text-slate-200 backdrop-blur-md border border-slate-700/80 shadow-2xl animate-fade-in">
          Click or use → / ← to navigate · Press <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-indigo-300">F</kbd> for Fit/Fill · <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-indigo-300">Esc</kbd> to exit
        </div>
      )}
    </div>
  );
}
