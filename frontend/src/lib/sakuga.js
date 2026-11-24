import { useEffect, useRef, useCallback } from 'react';

/**
 * Pasang listener event NATIVE pada custom element Sakuga.
 *
 * Kenapa tidak pakai onChange React? Beberapa event (change/input pada
 * <sakuga-input>, <sakuga-checkbox>, <sakuga-tabs>) datang dari shadow DOM
 * dan tidak selalu diterjemahkan React ke synthetic event-nya. Mendengar
 * event aslinya langsung selalu aman.
 *
 *   const ref = useRef();
 *   useSakugaEvent(ref, 'input', (e) => setName(e.target.value));
 *   <sakuga-input ref={ref} />
 */
export function useSakugaEvent(ref, type, handler) {
  const saved = useRef(handler);

  // Simpan handler terbaru setelah render (bukan saat render, aturan React)
  useEffect(() => {
    saved.current = handler;
  });

  useEffect(() => {
    const el = ref && ref.current;
    if (!el || typeof el.addEventListener !== 'function') return undefined;

    const listener = (e) => saved.current(e, el);
    el.addEventListener(type, listener);
    return () => el.removeEventListener(type, listener);
  }, [ref, type]);
}

/**
 * Pasang <sakuga-toast> dan dapatkan fungsi show(message).
 *
 *   const { ref: toastRef, show } = useSakugaToast();
 *   <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 100 }} />
 *   show('Acara berhasil dibuat');
 */
export function useSakugaToast() {
  const ref = useRef(null);

  const show = useCallback((message) => {
    const el = ref.current;
    if (el && typeof el.show === 'function') el.show(message);
  }, []);

  return { ref, show };
}

/** Baca nilai <sakuga-input> lewat ref (komponen ini tidak controlled oleh React). */
export function readSakugaValue(ref, fallback = '') {
  const el = ref && ref.current;
  if (!el) return fallback;
  return typeof el.value === 'string' ? el.value : fallback;
}
