import { useCallback, useEffect, useState } from 'react';
import MainSlide from './MainSlide';
import ThumbnailRail from './ThumbnailRail';

export default function Viewer({ meta, doc, numPages, onReplace, onStartSlideshow }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const goTo = useCallback(
    (n) => {
      setCurrentPage(Math.min(Math.max(n, 1), numPages || 1));
    },
    [numPages]
  );

  const goNext = useCallback(() => goTo(currentPage + 1), [currentPage, goTo]);
  const goPrev = useCallback(() => goTo(currentPage - 1), [currentPage, goTo]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        e.key === ' '
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
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(numPages || 1);
      } else if (e.key === 's' || e.key === 'S') {
        setShowThumbnails((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, goTo, numPages]);

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f9] text-[#1f1f1f] overflow-hidden select-none">
      <header className="flex h-14 items-center justify-between border-b border-[#dadce0] bg-[#ffffff] px-4 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowThumbnails((v) => !v)}
            title={showThumbnails ? 'Hide Filmstrip (S)' : 'Show Filmstrip (S)'}
            className={`cursor-pointer rounded-full p-2 text-[#444746] transition hover:bg-[#f1f3f4] hover:text-[#1f1f1f] ${
              !showThumbnails ? 'bg-[#e8eaed] text-[#0b57d0]' : ''
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f9ab00] text-white shadow-xs shrink-0">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v7H7z" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-medium text-[#1f1f1f] leading-snug">
                {meta?.originalName || 'Untitled presentation'}
              </h1>
              <span className="hidden sm:inline-flex text-[11px] font-medium text-[#444746] bg-[#f1f3f4] border border-[#dadce0] px-2 py-0.5 rounded-full">
                {numPages} {numPages === 1 ? 'slide' : 'slides'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onReplace}
            className="cursor-pointer rounded-full border border-[#747775] px-4 py-1.5 text-xs font-medium text-[#1f1f1f] hover:bg-[#f1f3f4] transition active:scale-95"
          >
            Upload New
          </button>

          <button
            onClick={() => onStartSlideshow(currentPage)}
            className="cursor-pointer flex items-center gap-2 rounded-full bg-[#c2e7ff] text-[#001d35] hover:bg-[#b3dcf7] px-4 py-1.5 text-xs font-semibold transition active:scale-95 shadow-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Slideshow
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {showThumbnails && (
          <ThumbnailRail
            doc={doc}
            numPages={numPages}
            currentPage={currentPage}
            onSelect={goTo}
          />
        )}

        <MainSlide
          doc={doc}
          currentPage={currentPage}
          numPages={numPages}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>
    </div>
  );
}
