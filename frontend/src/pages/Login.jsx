import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Moon, Sun, Lock, Mail, User } from 'lucide-react';
import { useSakugaEvent, useSakugaToast, readSakugaValue } from '../lib/sakuga';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();

  // State untuk form
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('pemilik_acara');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ref elemen sakuga: nilai dibaca saat submit, event didengar langsung
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const roleRef = useRef(null);
  const submitRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  // Peran dipilih lewat <sakuga-tabs>
  useSakugaEvent(roleRef, 'change', (e) => {
    const value = e.detail?.value ?? roleRef.current?.value;
    if (value) setRole(value);
  });

  // State & Logika untuk Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('theme') === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fullName = readSakugaValue(nameRef).trim();
    const email = readSakugaValue(emailRef).trim();
    const password = readSakugaValue(passwordRef);

    if (!email || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg('Format email belum benar, cek lagi ya.');
      return;
    }
    if (isRegister && !fullName) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isRegister) {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            { id: authData.user.id, role: role, full_name: fullName },
          ]);
          if (profileError) throw profileError;

          show('Registrasi berhasil! Silakan login.');
          setIsRegister(false);
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', authData.user.id)
          .single();

        if (profileError || !profile) throw new Error('Data profil tidak ditemukan.');

        localStorage.setItem('user', JSON.stringify({ ...authData.user, role: profile.role }));

        if (profile.role === 'pemilik_acara') navigate('/pemilik');
        else if (profile.role === 'fotografer') navigate('/fotografer');
        else if (profile.role === 'admin') navigate('/admin');
      }
    } catch (err) {
      const raw = err.message || 'Terjadi kesalahan';
      const map = {
        'Invalid login credentials': 'Email atau kata sandi salah.',
        'User already registered': 'Email ini sudah terdaftar. Silakan masuk.',
        'Password should be at least 6 characters': 'Kata sandi minimal 6 karakter.',
      };
      setErrorMsg(map[raw] || raw);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Latar anime: garis kecepatan + kana besar */}
      <div className="sk-speedlines" aria-hidden="true" />
      <div className="sk-watermark" aria-hidden="true">写真</div>

      {/* Tombol Toggle Tema (Kanan Atas) */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        aria-label="Ganti tema terang / gelap"
        className="sk-btn-ghost absolute top-6 right-6 z-10 justify-center"
        style={{ width: 46, height: 46, borderRadius: '50%', padding: 0 }}
      >
        {isDarkMode ? <Sun size={19} /> : <Moon size={19} />}
      </button>

      {/* Card Login */}
      <div className="relative z-10 w-full max-w-md sk-card p-7 sm:p-8">
        {/* Header Logo & Judul */}
        <div className="text-center mb-7">
          <span className="sk-kicker justify-center mb-4">Sakuga Photo</span>
          <div
            className="w-16 h-16 mx-auto mb-4 grid place-items-center rounded-2xl bg-pri text-white border-[3px] border-ink"
            style={{ boxShadow: '6px 6px 0 var(--color-acc)' }}
          >
            <User size={30} strokeWidth={2.4} />
          </div>
          <h2 className="text-[26px] font-extrabold tracking-tight">
            {isRegister ? 'Buat Akun Baru' : 'Selamat Datang'}
          </h2>
          <p className="text-sm text-dim mt-1.5 font-medium">
            Aplikasi Pencocokan Foto Pernikahan
          </p>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="sk-alert sk-alert-error mb-5" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Peran dengan <sakuga-tabs> */}
          <div>
            <div className="sk-field-label">Masuk sebagai</div>
            <sakuga-tabs
              ref={roleRef}
              label="Pilih peran"
              selected={role === 'pemilik_acara' ? 0 : 1}
            >
              <option value="pemilik_acara">Pemilik Acara</option>
              <option value="fotografer">Fotografer</option>
            </sakuga-tabs>
          </div>

          {/* Input Nama Lengkap (Khusus Mode Registrasi) */}
          {isRegister && (
            <div>
              <div className="sk-field-label">
                <User size={14} /> Nama Lengkap
              </div>
              <sakuga-input
                ref={nameRef}
                type="text"
                name="fullname"
                label="Nama lengkap"
                placeholder="Nama lengkap"
                autoComplete="name"
              />
            </div>
          )}

          {/* Input Email */}
          <div>
            <div className="sk-field-label">
              <Mail size={14} /> Email
            </div>
            <sakuga-input
              ref={emailRef}
              type="email"
              name="email"
              label="Email"
              placeholder="nama@email.com"
              autoComplete="email"
            />
          </div>

          {/* Input Sandi */}
          <div>
            <div className="sk-field-label">
              <Lock size={14} /> Kata Sandi
            </div>
            <sakuga-input
              ref={passwordRef}
              type="password"
              name="password"
              label="Kata sandi"
              placeholder="Kata sandi"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {/* Tombol Utama */}
          <sakuga-button
            ref={submitRef}
            type="submit"
            disabled={loading}
            className="sk-btn-full mt-2"
          >
            {loading ? 'Memproses...' : isRegister ? 'Buat Akun' : 'Masuk Sekarang'}
          </sakuga-button>
        </form>

        {/* Lupa password? (W-01 v1.1, FR-32) */}
        {!isRegister && (
          <div className="text-center mt-4">
            <Link to="/lupa-password" className="sk-link text-sm">
              Lupa password?
            </Link>
          </div>
        )}

        {/* Footer Text (Toggle Mode Login / Register) */}
        <div className="text-center mt-7 text-sm text-dim font-medium">
          {isRegister ? (
            <p>
              Sudah punya akun?{' '}
              <button type="button" onClick={() => setIsRegister(false)} className="sk-link">
                Masuk
              </button>
            </p>
          ) : (
            <p>
              Belum punya akun?{' '}
              <button type="button" onClick={() => setIsRegister(true)} className="sk-link">
                Daftar Gratis
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Toast ala sakuga untuk pesan sukses */}
      <sakuga-toast
        ref={toastRef}
        style={{ position: 'fixed', right: 24, bottom: 24 }}
      />
    </div>
  );
}
