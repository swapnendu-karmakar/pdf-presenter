import { useEffect, useRef } from 'react';

export default function PdfPageCanvas({
  doc,
  pageNumber,
  targetWidth,
  className = '',
  onRendered,
}) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!doc || doc.destroyed || !pageNumber || !targetWidth) return;
    let cancelled = false;

    try {
      const pagePromise = doc.getPage(pageNumber);
      if (!pagePromise || typeof pagePromise.then !== 'function') return;

      pagePromise
        .then((page) => {
          if (cancelled || doc.destroyed) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const dpr = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = canvasRef.current;
          if (!canvas) return;

          if (!canvas.style.width) {
            canvas.style.width = `${targetWidth}px`;
            canvas.style.height = `${targetWidth * (baseViewport.height / baseViewport.width)}px`;
          }

          try {
            renderTaskRef.current?.cancel?.();
          } catch {}

          const offscreen = document.createElement('canvas');
          offscreen.width = viewport.width;
          offscreen.height = viewport.height;
          const offscreenCtx = offscreen.getContext('2d');

          const task = page.render({ canvasContext: offscreenCtx, viewport });
          renderTaskRef.current = task;

          task.promise
            .then(() => {
              if (cancelled || doc.destroyed) return;
              const activeCanvas = canvasRef.current;
              if (!activeCanvas) return;

              if (activeCanvas.width !== viewport.width || activeCanvas.height !== viewport.height) {
                activeCanvas.width = viewport.width;
                activeCanvas.height = viewport.height;
              }
              activeCanvas.style.width = `${targetWidth}px`;
              activeCanvas.style.height = `${targetWidth * (baseViewport.height / baseViewport.width)}px`;

              const ctx = activeCanvas.getContext('2d');
              ctx.drawImage(offscreen, 0, 0);
              onRendered?.();
            })
            .catch((err) => {
              if (err?.name !== 'RenderingCancelledException') {
                console.warn(`PDF page ${pageNumber} render warning:`, err?.message || err);
              }
            });
        })
        .catch((err) => {
          if (!cancelled) {
            console.warn(`PDF getPage(${pageNumber}) error:`, err?.message || err);
          }
        });
    } catch (err) {
      if (!cancelled) {
        console.warn(`PDF getPage(${pageNumber}) sync error:`, err?.message || err);
      }
    }

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel?.();
      } catch {}
    };
  }, [doc, pageNumber, targetWidth, onRendered]);

  return <canvas ref={canvasRef} className={className} />;
}
