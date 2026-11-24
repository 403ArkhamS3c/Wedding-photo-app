import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useSakugaToast, readSakugaValue } from '../lib/sakuga';
import { supabase } from '../lib/supabase';

/**
 * W-08 — Halaman Password Baru (Dokumen Aplikasi v1.1, FR-36..FR-39).
 *
 * Halaman ini hanya berguna lewat tautan reset di email
 * (event PASSWORD_RECOVERY / hash #type=recovery).
 */
export default function ResetPassword() {
  const navigate = useNavigate();

  const [siap, setSiap] = useState(false); // tautan reset valid & sesi pemulihan aktif
  const [galat, setGalat] = useState('');
  const [berhasil, setBerhasil] = useState(false);
  const [loading, setLoading] = useState(false);

  const sandiRef = useRef(null);
  const ulangRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  // Deteksi sesi pemulihan dari Supabase Auth (TC-38/TC-39/TC-43/TC-44)
  useEffect(() => {
    const hash = window.location.hash || '';

    if (/error=/i.test(hash)) {
      // Tautan tidak berlaku / kedaluwarsa / sudah dipakai
      setGalat('Tautan tidak berlaku, sudah kedaluwarsa, atau sudah dipakai. Minta tautan baru ya.');
    } else if (/type=recovery/i.test(hash)) {
      setSiap(true);
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSiap(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const simpan = async (e) => {
    e.preventDefault();
    const sandi = readSakugaValue(sandiRef);
    const ulang = readSakugaValue(ulangRef);

    // FR-37: minimal 8 karakter dan kedua isian sama
    if (sandi.length < 8) {
      setGalat('Password baru minimal 8 karakter.');
      return;
    }
    if (sandi !== ulang) {
      setGalat('Kedua isian password harus sama.');
      return;
    }

    setLoading(true);
    setGalat('');

    // FR-38: password disimpan lewat Supabase Auth (bukan teks biasa di aplikasi)
    const { error } = await supabase.auth.updateUser({ password: sandi });
    setLoading(false);

    if (error) {
      setGalat('Gagal mengganti password. Coba lagi beberapa saat lagi.');
      return;
    }

    setBerhasil(true);
    show('Password berhasil diganti!');

    // Akhiri sesi pemulihan lokal, lalu arahkan ke login
    await supabase.auth.signOut();
    setTimeout(() => navigate('/'), 1800);
  };

  // Halaman dibuka tanpa tautan reset (TC-39)
  if (!siap) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <div className="sk-speedlines" aria-hidden="true" />
        <div className="sk-watermark" aria-hidden="true">鍵</div>

        <div className="relative z-10 w-full max-w-md sk-card p-7 sm:p-8 text-center space-y-4">
          <div
            className="w-16 h-16 mx-auto grid place-items-center rounded-2xl bg-soft/40 text-pri border-[3px] border-ink"
            style={{ boxShadow: '6px 6px 0 var(--color-soft)' }}
          >
            <KeyRound size={30} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Password Baru</h2>
            <p className="text-sm text-dim mt-2 font-medium leading-relaxed">
              Buka halaman ini dari tautan di email Anda.
            </p>
          </div>

          {galat && (
            <div className="sk-alert sk-alert-error text-left" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{galat}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link to="/lupa-password" className="sk-btn-ghost w-full justify-center">
              Minta Tautan Baru
            </Link>
            <Link to="/" className="sk-link text-sm">
              Kembali ke login
            </Link>
          </div>
        </div>

        <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="sk-speedlines" aria-hidden="true" />
      <div className="sk-watermark" aria-hidden="true">鍵</div>

      <div className="relative z-10 w-full max-w-md sk-card p-7 sm:p-8 space-y-5">
        <div>
          <span className="sk-kicker mb-2">パスワード新規</span>
          <h2 className="text-2xl font-extrabold">Atur Password Baru</h2>
          <p className="text-sm text-dim mt-2 font-medium">
            Masukkan password baru Anda dua kali, lalu simpan.
          </p>
        </div>

        {berhasil ? (
          <div className="text-center space-y-4 py-4">
            <div
              className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-[#2fbf87] text-white border-[3px] border-ink"
              style={{ boxShadow: '5px 5px 0 var(--color-soft)' }}
            >
              <CheckCircle2 size={34} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold">Password Berhasil Diganti</h3>
              <p className="text-sm text-dim mt-2 font-medium">
                Silakan masuk dengan password baru Anda.
              </p>
            </div>
          </div>
        ) : (
          <>
            {galat && (
              <div className="sk-alert sk-alert-error" role="alert">
                <span aria-hidden="true">⚠</span>
                <span>{galat}</span>
              </div>
            )}

            <form onSubmit={simpan} className="space-y-4">
              <div>
                <div className="sk-field-label">
                  <Lock size={14} /> Password Baru
                </div>
                <sakuga-input
                  ref={sandiRef}
                  type="password"
                  name="new-password"
                  label="Password baru"
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <div className="sk-field-label">
                  <ShieldCheck size={14} /> Ulangi Password
                </div>
                <sakuga-input
                  ref={ulangRef}
                  type="password"
                  name="confirm-password"
                  label="Ulangi password"
                  placeholder="Ketik ulang password baru"
                  autoComplete="new-password"
                />
                <p className="text-[11px] font-bold text-dim mt-2">
                  Minimal 8 karakter dan kedua isian harus sama.
                </p>
              </div>

              <sakuga-button type="submit" disabled={loading} className="sk-btn-full">
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              </sakuga-button>
            </form>
          </>
        )}

        <div className="text-center">
          <Link to="/" className="sk-link text-sm">
            Kembali ke login
          </Link>
        </div>
      </div>

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
