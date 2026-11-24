import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useSakugaToast, readSakugaValue } from '../lib/sakuga';
import { supabase } from '../lib/supabase';

/**
 * W-07 — Halaman Lupa Password (Dokumen Aplikasi v1.1, FR-32..FR-35, FR-40).
 *
 * Pesan hasil permintaan SELALU sama untuk email terdaftar maupun tidak
 * (NFR-12: tidak membocorkan keberadaan akun).
 */
export default function LupaPassword() {
  const [terkirim, setTerkirim] = useState(false);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState('');

  const emailRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  const kirim = async (e) => {
    e.preventDefault();
    const email = readSakugaValue(emailRef).trim();

    // TC-37: form menolak format email yang salah
    if (!email) {
      setGalat('Email wajib diisi.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setGalat('Format email belum benar, cek lagi ya.');
      return;
    }

    setLoading(true);
    setGalat('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      // FR-40 / NFR-15: kegagalan pengiriman (mis. kuota email habis)
      // tampil sebagai pesan ramah, aplikasi tidak error.
      const raw = error.message || '';
      if (/rate limit|too many|quota/i.test(raw)) {
        setGalat('Batas pengiriman email tercapai. Coba lagi kira-kira satu jam lagi ya.');
      } else {
        setGalat('Permintaan gagal. Coba lagi beberapa saat lagi.');
      }
      return;
    }

    // FR-35: pesan identik untuk email terdaftar maupun tidak
    setTerkirim(true);
    show('Permintaan reset dikirim (bila email terdaftar).');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="sk-speedlines" aria-hidden="true" />
      <div className="sk-watermark" aria-hidden="true">鍵</div>

      <div className="relative z-10 w-full max-w-md sk-card p-7 sm:p-8 space-y-5">
        {/* Kembali ke login (W-07) */}
        <Link to="/" className="sk-link inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={15} strokeWidth={3} />
          Kembali ke login
        </Link>

        {terkirim ? (
          /* Tampilan pesan generik setelah permintaan terkirim */
          <div className="text-center space-y-4 py-4">
            <div
              className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-[#2fbf87] text-white border-[3px] border-ink"
              style={{ boxShadow: '5px 5px 0 var(--color-soft)' }}
            >
              <CheckCircle2 size={34} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">Tautan Terkirim</h2>
              <p className="text-sm text-dim mt-2 font-medium leading-relaxed">
                Jika email terdaftar, tautan reset sudah dikirim. Cek kotak masuk
                Anda (jangan lupa folder spam).
              </p>
            </div>
            <p className="text-xs font-bold text-dim">
              Tidak datang juga? Tunggu beberapa menit, lalu coba lagi satu jam
              kemudian — pengiriman email dibatasi.
            </p>
            <div className="flex flex-col gap-3 pt-1">
              <sakuga-button
                className="sk-btn-full"
                onClick={() => setTerkirim(false)}
              >
                Kirim Ulang
              </sakuga-button>
              <Link to="/" className="sk-link text-sm text-center">
                Kembali ke login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <span className="sk-kicker mb-2">パスワード再設定</span>
              <h2 className="text-2xl font-extrabold">Lupa Password</h2>
              <p className="text-sm text-dim mt-2 font-medium leading-relaxed">
                Masukkan email akun Anda. Jika terdaftar, kami kirim tautan untuk
                mengatur ulang password.
              </p>
            </div>

            {galat && (
              <div className="sk-alert sk-alert-error" role="alert">
                <span aria-hidden="true">⚠</span>
                <span>{galat}</span>
              </div>
            )}

            <form onSubmit={kirim} className="space-y-4">
              <div>
                <div className="sk-field-label">
                  <Mail size={14} /> Email
                </div>
                <sakuga-input
                  ref={emailRef}
                  type="email"
                  name="email"
                  label="Email akun"
                  placeholder="nama@email.com"
                  autoComplete="email"
                />
              </div>

              <sakuga-button type="submit" disabled={loading} className="sk-btn-full">
                {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
              </sakuga-button>
            </form>
          </>
        )}
      </div>

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
