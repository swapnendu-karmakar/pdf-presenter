import { useEffect, useRef, useState } from 'react';
import PdfPageCanvas from './PdfPageCanvas';
import ErrorBoundary from './ErrorBoundary';

export default function MainSlide({
  doc,
  currentPage,
  numPages,
  onPrev,
  onNext,
}) {
  const containerRef = useRef(null);
  const [containerDims, setContainerDims] = useState({ width: 800, height: 600 });
  const [targetWidth, setTargetWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || doc.destroyed || !containerDims.width || !containerDims.height) return;
    let cancelled = false;

    try {
      const pagePromise = doc.getPage(currentPage);
      if (!pagePromise || typeof pagePromise.then !== 'function') return;

      pagePromise
        .then((page) => {
          if (cancelled || doc.destroyed) return;
          const vp = page.getViewport({ scale: 1 });
          const aspect = vp.width / vp.height;

          const maxW = Math.max(100, containerDims.width - 32);
          const maxH = Math.max(100, containerDims.height - 32);

          const fitW = Math.min(maxW, maxH * aspect);
          setTargetWidth(Math.round(fitW));
        })
        .catch(() => {});
    } catch {}

    return () => {
      cancelled = true;
    };
  }, [doc, currentPage, containerDims]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-[#f0f4f9] p-6 select-none"
    >
      {doc && (
        <div className="relative flex items-center justify-center">
          <ErrorBoundary>
            <PdfPageCanvas
              doc={doc}
              pageNumber={currentPage}
              targetWidth={targetWidth}
              className="rounded-[2px] bg-white ring-1 ring-black/5 shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)]"
            />
          </ErrorBoundary>
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-white px-2 py-1 shadow-md border border-[#dadce0] text-[#444746]">
        <button
          onClick={onPrev}
          disabled={currentPage <= 1}
          title="Previous slide"
          aria-label="Previous slide"
          className="cursor-pointer rounded-full p-1.5 text-[#444746] hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <span className="px-2 text-xs font-medium text-[#444746] select-none min-w-[70px] text-center">
          {currentPage} / {numPages}
        </span>

        <button
          onClick={onNext}
          disabled={currentPage >= numPages}
          title="Next slide"
          aria-label="Next slide"
          className="cursor-pointer rounded-full p-1.5 text-[#444746] hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
