import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Upload, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useSakugaEvent, useSakugaToast, readSakugaValue } from '../lib/sakuga';

export default function RegistrasiTamu() {
  const { guestCode } = useParams();
  const navigate = useNavigate();

  // Info acara (untuk sementara memakai nama generik; bisa diganti query asli)
  const eventInfo = { name: 'Acara Pernikahan', guestCode };
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  const nameRef = useRef(null);
  const consentRef = useRef(null);
  const submitRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  // Checkbox persetujuan memakai <sakuga-checkbox>
  useSakugaEvent(consentRef, 'change', (e) => {
    setConsent(!!(e.target ?? consentRef.current)?.checked);
  });

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = readSakugaValue(nameRef).trim();

    if (!consent) {
      setErrorMsg('Anda harus menyetujui penggunaan data wajah.');
      show('Centang persetujuan dulu ya!');
      return;
    }
    if (!file) {
      setErrorMsg('Silakan ambil selfie atau pilih berkas gambar.');
      show('Selfie belum dipilih.');
      return;
    }
    if (!name) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('guest_code', guestCode);
    formData.append('name', name);
    formData.append('selfie', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/guests/register`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessData(result);
        show('Wajah terdaftar! Selamat datang.');
      } else {
        // Menerjemahkan pesan galat dari Service Python
        let msg = result.error;
        if (msg === 'blurry') msg = 'Selfie terlalu buram. Pastikan kamera stabil dan fokus.';
        else if (msg === 'too_dark') msg = 'Pencahayaan foto terlalu gelap/terang.';
        else if (msg === 'no_face') msg = 'Wajah tidak terdeteksi. Pastikan wajah menghadap lurus.';
        else if (msg === 'multiple_faces') msg = 'Terdeteksi lebih dari 1 wajah. Harap selfie sendiri.';

        setErrorMsg(msg || 'Registrasi gagal. Silakan coba lagi.');
      }
    } catch (err) {
      setErrorMsg('Kesalahan koneksi server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tampilan Berhasil Registrasi (W-04)
  if (successData) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <div className="sk-speedlines" aria-hidden="true" />
        <div className="sk-watermark" aria-hidden="true">成功</div>

        <div className="relative z-10 bg-card max-w-md w-full p-7 sm:p-8 sk-card text-center space-y-5">
          <span className="sk-kicker justify-center">登録完了</span>
          <div
            className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-[#2fbf87] text-white border-[3px] border-ink"
            style={{ boxShadow: '5px 5px 0 var(--color-soft)' }}
          >
            <CheckCircle2 size={34} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Pendaftaran Berhasil!</h2>
            <p className="text-sm text-dim mt-2 font-medium leading-relaxed">
              Data wajah Anda telah terdaftar. Anda dapat membuka galeri foto pribadi kapan saja.
            </p>
          </div>

          <div className="sk-card-soft p-4 text-left space-y-2">
            <div className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-dim">
              Tautan Pribadi Anda
            </div>
            <div className="sk-code text-xs break-all">
              {window.location.origin}/gallery?token={successData.access_token}
            </div>
          </div>

          <sakuga-button
            ref={submitRef}
            className="sk-btn-full"
            onClick={() => navigate(`/gallery?token=${successData.access_token}`)}
          >
            Buka Galeri Foto Saya
          </sakuga-button>
        </div>

        <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="sk-speedlines" aria-hidden="true" />
      <div className="sk-watermark" aria-hidden="true">顔</div>

      {/* Container Registrasi Wajah (W-04) */}
      <div className="relative z-10 bg-card max-w-md w-full p-6 sm:p-8 sk-card space-y-5">
        <div className="text-center">
          <span className="sk-kicker justify-center mb-3">顔登録 Face ID</span>
          <h2 className="text-2xl font-extrabold">Daftarkan Wajah Anda</h2>
          <p className="text-sm text-dim mt-1.5 font-medium">
            Acara:{' '}
            <span className="text-acc font-extrabold">{eventInfo.name}</span>{' '}
            <span className="sk-code text-xs">{guestCode}</span>
          </p>
        </div>

        {errorMsg && (
          <div className="sk-alert sk-alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="sk-field-label">Nama Lengkap</div>
            <sakuga-input
              ref={nameRef}
              type="text"
              name="guest_name"
              label="Nama lengkap"
              placeholder="Masukkan nama Anda"
              autoComplete="name"
            />
          </div>

          {/* Oval Frame Preview Selfie (W-04) */}
          <div>
            <div className="sk-field-label">
              <Camera size={14} /> Foto Selfie
            </div>
            <div
              className="relative aspect-[3/4] w-44 mx-auto rounded-[50%] overflow-hidden flex items-center justify-center"
              style={{
                border: '4px dashed var(--color-pri)',
                background: 'color-mix(in srgb, var(--color-soft) 18%, transparent)',
                boxShadow: '6px 6px 0 var(--color-soft)',
              }}
            >
              {preview ? (
                <img src={preview} alt="Selfie Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4 text-dim">
                  <Camera size={34} className="mx-auto mb-2 opacity-70" />
                  <span className="text-xs font-bold">Foto wajah lurus ke depan</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-center mt-4">
              <label className="sk-btn-ghost cursor-pointer">
                <Camera size={14} />
                <span>Ambil Selfie</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <label className="sk-btn-ghost sk-btn-soft cursor-pointer">
                <Upload size={14} />
                <span>Pilih Berkas</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {file && (
              <p className="text-center text-xs font-bold text-acc mt-2">
                ✓ {file.name}
              </p>
            )}
          </div>

          {/* Persetujuan Data Wajah (Consent Checkbox) (W-04) */}
          <div className="sk-card-soft p-3.5 flex items-start gap-3">
            <ShieldCheck size={18} className="shrink-0 text-pri mt-0.5" />
            <div className="flex-1">
              <sakuga-checkbox ref={consentRef} name="consent">
                Saya menyetujui penggunaan data biometrik wajah saya khusus untuk proses pencocokan foto pada acara pernikahan ini.
              </sakuga-checkbox>
            </div>
          </div>

          <sakuga-button ref={submitRef} type="submit" disabled={loading} className="sk-btn-full">
            {loading ? 'Memvalidasi AI...' : 'Daftar Wajah'}
          </sakuga-button>
        </form>
      </div>

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
