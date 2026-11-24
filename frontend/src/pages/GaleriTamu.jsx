import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Download, ImageIcon, Info, Trash2 } from 'lucide-react';
import { useSakugaToast } from '../lib/sakuga';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function GaleriTamu() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [guest, setGuest] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ref: toastRef, show } = useSakugaToast();

  const fetchMatchedPhotos = async () => {
    setLoading(true);

    // 1. Ambil data tamu berdasarkan token unik
    const { data: guestData, error: guestErr } = await supabase
      .from('guests')
      .select('id, name, event_id, events(name)')
      .eq('access_token', token)
      .single();

    if (guestErr || !guestData) {
      setLoading(false);
      return;
    }

    setGuest(guestData);

    // 2. Ambil foto hasil kecocokan dari photo_matches join photos
    const { data: matches, error: matchErr } = await supabase
      .from('photo_matches')
      .select('photo_id, photos(photo_path)')
      .eq('guest_id', guestData.id);

    if (!matchErr && matches) {
      const photoList = matches.map((m) => {
        const { data } = supabase.storage.from('event-photos').getPublicUrl(m.photos.photo_path);
        return { id: m.photo_id, url: data.publicUrl };
      });
      setPhotos(photoList);
    }
    setLoading(false);
  };

  // Muat foto yang cocok setiap kali token berubah
  useEffect(() => {
    if (token) {
      fetchMatchedPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fitur Penghapusan Data Wajah Tamu
  const handleDeleteMyData = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data biometrik wajah Anda dari sistem?')) return;

    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('access_token', token);

    if (!error) {
      show('Data wajah Anda berhasil dihapus.');
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } else {
      show('Gagal menghapus data. Coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="sk-loading">
        <div className="sk-spinner" />
        <p>Mencari foto Anda...</p>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="sk-card max-w-md w-full p-8 text-center space-y-3">
          <span className="sk-kicker justify-center">リンク失効</span>
          <h2 className="text-xl font-extrabold">Tautan Tidak Valid</h2>
          <p className="text-sm font-bold text-dim">
            Tautan pribadi Anda salah atau telah kedaluwarsa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Galeri Tamu (W-05) */}
        <div className="sk-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="sk-kicker mb-2">写真ギャラリー · Galeri Anda</span>
            <h1 className="text-2xl font-extrabold">Foto Anda</h1>
            <p className="text-sm font-medium text-dim mt-1">
              Halo <span className="text-acc font-extrabold">{guest.name}</span>, berikut foto
              acara yang memuat wajah Anda.
            </p>
          </div>
          <button
            onClick={handleDeleteMyData}
            className="sk-btn-ghost sk-btn-danger self-start md:self-auto"
          >
            <Trash2 size={14} />
            <span>Hapus Data Wajah Saya</span>
          </button>
        </div>

        {/* Galeri Grid Foto (W-05) */}
        {photos.length > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <span className="sk-kicker">{photos.length} foto ditemukan</span>
              <div className="flex-1 h-[3px] bg-soft/60 rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="sk-photo aspect-square"
                  style={{ '--sk-rot': `${i % 2 === 0 ? -0.8 : 0.8}deg` }}
                >
                  <img src={photo.url} alt="Foto Saya" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-ink/45 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                    <a
                      href={photo.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Unduh foto"
                      className="w-11 h-11 grid place-items-center bg-card text-ink rounded-full border-[3px] border-ink"
                      style={{ boxShadow: '4px 4px 0 var(--color-acc)' }}
                    >
                      <Download size={18} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Tampilan Jika Belum Ada Kecocokan Foto (W-05) */
          <div className="sk-card p-10 text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto grid place-items-center rounded-2xl bg-soft/40 text-pri border-[3px] border-ink"
              style={{ boxShadow: '5px 5px 0 var(--color-soft)' }}
            >
              <ImageIcon size={30} />
            </div>
            <h3 className="font-extrabold text-lg">Foto Anda belum ditemukan</h3>
            <div className="sk-alert sk-alert-warn max-w-md mx-auto text-left">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                Foto Anda mungkin belum diunggah oleh fotografer. Silakan cek kembali secara
                berkala dalam 3x24 jam.
              </span>
            </div>
          </div>
        )}
      </div>

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
