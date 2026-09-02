import { useEffect, useState } from 'react';
import pdfjsLib from '../lib/pdfjs';

export default function usePdfDocument(source) {
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    let isFinished = false;

    if (!source) {
      queueMicrotask(() => {
        if (!cancelled) {
          setDoc(null);
          setNumPages(0);
          setLoading(false);
          setProgress(0);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
        setProgress(10);
      }
    });

    async function loadPdf() {
      try {
        let docParams;
        if (typeof source === 'string') {
          docParams = { url: source };
        } else if (source instanceof File || source instanceof Blob) {
          const arrayBuffer = await source.arrayBuffer();
          if (cancelled) return;
          docParams = { data: new Uint8Array(arrayBuffer) };
        } else if (source instanceof ArrayBuffer) {
          docParams = { data: new Uint8Array(source) };
        } else if (source?.data) {
          docParams = source;
        } else {
          throw new Error('Unsupported PDF source format');
        }

        loadingTask = pdfjsLib.getDocument(docParams);

        loadingTask.onProgress = ({ loaded, total }) => {
          if (cancelled) return;
          if (total > 0) {
            const pct = Math.min(95, Math.max(15, Math.round((loaded / total) * 90)));
            setProgress(pct);
          } else {
            setProgress((prev) => Math.min(prev + 10, 85));
          }
        };

        const pdf = await loadingTask.promise;
        if (cancelled) {
          try { pdf.destroy(); } catch {}
          return;
        }

        isFinished = true;
        setProgress(100);
        setDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'RenderingCancelledException') return;
        setError(err?.message || 'Failed to load PDF');
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (!isFinished && loadingTask) {
        try {
          loadingTask.destroy();
        } catch {}
      }
    };
  }, [source]);

  return { doc, numPages, loading, progress, error };
}
