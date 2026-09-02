import { useEffect, useRef } from 'react';
import PdfPageCanvas from './PdfPageCanvas';
import ErrorBoundary from './ErrorBoundary';

export default function ThumbnailRail({ doc, numPages, currentPage, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [currentPage]);

  return (
    <aside className="flex h-full w-56 flex-col gap-2.5 overflow-y-auto border-r border-[#dadce0] bg-[#ffffff] py-3 px-2 select-none">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
        const isActive = n === currentPage;
        return (
          <div
            key={n}
            ref={isActive ? activeRef : null}
            onClick={() => onSelect(n)}
            className="cursor-pointer group flex items-center gap-2 p-1 rounded-lg transition-colors hover:bg-[#f1f3f4]"
          >
            <span
              className={`text-xs font-medium w-4 text-right shrink-0 select-none ${
                isActive ? 'text-[#0b57d0] font-bold' : 'text-[#444746]'
              }`}
            >
              {n}
            </span>

            <div
              className={`relative flex-1 overflow-hidden bg-white transition-colors ${
                isActive
                  ? 'border-2 border-[#0b57d0] rounded-[6px] shadow-sm'
                  : 'border border-[#dadce0] rounded-[6px] group-hover:border-[#747775]'
              }`}
            >
              <ErrorBoundary
                fallback={
                  <div className="h-24 w-full bg-[#f8fafd] flex items-center justify-center text-xs text-[#747775]">
                    Slide {n}
                  </div>
                }
              >
                <PdfPageCanvas doc={doc} pageNumber={n} targetWidth={180} />
              </ErrorBoundary>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
