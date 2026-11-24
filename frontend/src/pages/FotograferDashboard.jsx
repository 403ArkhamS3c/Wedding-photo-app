import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, Plus, Users, Image as ImageIcon, CheckCircle, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import { useSakugaToast, readSakugaValue } from '../lib/sakuga';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function FotograferDashboard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [stats, setStats] = useState({ guests: 0, photos: 0, processed: 0 });
  const [loading, setLoading] = useState(true);

  // Modal Join Acara
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Upload State
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const refCodeRef = useRef(null);
  const progressRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  // Progres AI match digerakkan <sakuga-progress>
  const progressPercentage = stats.photos > 0 ? Math.round((stats.processed / stats.photos) * 100) : 0;
  useEffect(() => {
    const el = progressRef.current;
    if (el && typeof el.set === 'function') el.set(progressPercentage / 100);
  }, [progressPercentage]);

  // Fetch daftar acara yang diikuti fotografer
  const fetchPhotographerEvents = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) {
      window.location.href = '/';
      return;
    }

    // Query tabel event_photographers join events
    const { data, error } = await supabase
      .from('event_photographers')
      .select('event_id, events(*)')
      .eq('photographer_id', user.id);

    if (!error && data) {
      const eventList = data.map(item => item.events);
      setEvents(eventList);
      if (eventList.length > 0 && !selectedEvent) {
        setSelectedEvent(eventList[0]);
      }
    }
    setLoading(false);
  };

  // Fetch statistik acara (jumlah tamu terdaftar & foto diproses)
  const fetchEventStats = async (eventId) => {
    const { count: guestCount } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    const { data: photoData } = await supabase
      .from('photos')
      .select('id, processed')
      .eq('event_id', eventId);

    const totalPhotos = photoData ? photoData.length : 0;
    const processedPhotos = photoData ? photoData.filter(p => p.processed).length : 0;

    setStats({
      guests: guestCount || 0,
      photos: totalPhotos,
      processed: processedPhotos
    });
  };

  // Gabung Acara via Kode Referral
  const handleJoinEvent = async (e) => {
    e.preventDefault();
    setJoinError('');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const code = readSakugaValue(refCodeRef).trim().toUpperCase();

    if (!code) {
      setJoinError('Kode referral masih kosong.');
      return;
    }

    // 1. Cari acara berdasarkan photographer_code
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('photographer_code', code)
      .single();

    if (eventError || !event) {
      setJoinError('Kode referral tidak valid atau tidak ditemukan.');
      return;
    }

    // 2. Simpan ke event_photographers
    const { error: joinErr } = await supabase
      .from('event_photographers')
      .insert([{ event_id: event.id, photographer_id: user.id }]);

    if (joinErr) {
      if (joinErr.code === '23505') {
        setJoinError('Anda sudah bergabung dalam acara ini.');
      } else {
        setJoinError(joinErr.message);
      }
      return;
    }

    setShowJoinModal(false);
    show('Berhasil bergabung ke acara!');
    fetchPhotographerEvents();
  };

  // Unggah foto batch ke Backend API
  const handleBatchUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !selectedEvent) return;

    setUploading(true);
    setUploadStatus('Mengunggah dan mengirim foto ke pemrosesan AI...');
    show('Mengunggah foto ke AI Match...');

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    const formData = new FormData();
    formData.append('event_id', selectedEvent.id);
    formData.append('uploader_id', user.id);

    Array.from(files).forEach((file) => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/photos/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (response.ok) {
        setUploadStatus(`Berhasil! ${files.length} foto sedang diproses.`);
        show(`${files.length} foto diterima. AI sedang bekerja!`);
        setFiles([]);
        setTimeout(() => setUploadStatus(''), 4000);
        fetchEventStats(selectedEvent.id);
      } else {
        show(result.error || 'Gagal mengunggah foto');
      }
    } catch (err) {
      show('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Muat daftar acara fotografer saat halaman dibuka
  useEffect(() => {
    fetchPhotographerEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventStats(selectedEvent.id);
    }

  }, [selectedEvent]);

  if (loading) {
    return (
      <div className="sk-loading">
        <div className="sk-spinner" />
        <p>Memuat data fotografer...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <span className="sk-kicker mb-2">撮影 · Photographer</span>
          <h1 className="text-2xl md:text-3xl font-extrabold">Dashboard Fotografer</h1>
          <p className="text-dim text-sm font-medium mt-1">
            Unggah foto acara dan pantau progres pencocokan wajah
          </p>
        </div>
        <div className="flex items-center gap-3">
          <sakuga-button onClick={() => setShowJoinModal(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={17} strokeWidth={3} />
              Gabung Acara
            </span>
          </sakuga-button>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            aria-label="Keluar"
            className="sk-btn-ghost sk-btn-danger"
            style={{ width: 44, height: 44, borderRadius: 12, padding: 0, justifyContent: 'center' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Acara Saya (W-03) */}
        <div className="lg:col-span-1 sk-card p-4 h-fit">
          <div className="sk-field-label">Acara Ditangani</div>
          {events.length === 0 ? (
            <p className="text-xs font-bold text-dim leading-relaxed">
              Belum ada acara. Klik “Gabung Acara” untuk memasukkan kode referral.
            </p>
          ) : (
            <div className="space-y-1.5">
              {events.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`sk-item ${selectedEvent?.id === evt.id ? 'sk-item-active' : ''}`}
                >
                  <div className="font-extrabold truncate">{evt.name}</div>
                  <div className="text-xs text-dim font-semibold mt-1">
                    {evt.event_date || 'Tanpa tanggal'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Konten Utama Upload & Progres (W-03) */}
        {selectedEvent ? (
          <div className="lg:col-span-3 space-y-6">
            {/* Header Acara Terpilih */}
            <div className="sk-card p-6 flex justify-between items-center gap-4">
              <div>
                <span className="sk-kicker mb-1.5">対象イベント</span>
                <h2 className="text-xl font-extrabold">{selectedEvent.name}</h2>
                <p className="text-sm text-dim font-semibold">{selectedEvent.event_date}</p>
              </div>
              <button
                onClick={() => fetchEventStats(selectedEvent.id)}
                aria-label="Segarkan statistik"
                className="sk-btn-ghost"
                style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}
              >
                <RefreshCw size={17} />
              </button>
            </div>

            {/* Grid Ringkasan Progres (W-03) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sk-stat">
                <div className="sk-iconbox sk-iconbox-pri">
                  <Users size={22} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{stats.guests}</div>
                  <div className="text-xs font-bold text-dim">Tamu Mendaftar Wajah</div>
                </div>
              </div>

              <div className="sk-stat">
                <div className="sk-iconbox sk-iconbox-acc">
                  <ImageIcon size={22} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{stats.photos}</div>
                  <div className="text-xs font-bold text-dim">Foto Diunggah</div>
                </div>
              </div>

              <div className="sk-stat flex-col items-stretch justify-center gap-1">
                <div className="flex justify-between text-xs font-extrabold mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={13} className="text-acc" />
                    Progres AI Match
                  </span>
                  <span className="text-acc">{progressPercentage}%</span>
                </div>
                <sakuga-progress
                  ref={progressRef}
                  label="Progres pencocokan wajah"
                  done-label="Selesai ✓"
                />
              </div>
            </div>

            {/* Area Dropzone Upload Foto Batch (W-03) */}
            <div className="sk-card p-6 space-y-4">
              <h3 className="font-extrabold flex items-center gap-2">
                <Upload size={18} className="text-pri" />
                Unggah Foto Acara
              </h3>

              {uploadStatus && (
                <div className="sk-alert sk-alert-ok" role="status">
                  <CheckCircle size={17} className="shrink-0 mt-0.5" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              <form onSubmit={handleBatchUpload} className="space-y-4">
                <div className="sk-dropzone">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    onChange={(e) => setFiles(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload size={38} className="mx-auto text-pri mb-3" />
                  <p className="text-sm font-extrabold">
                    {files.length > 0 ? `${files.length} file dipilih` : 'Klik atau seret file foto ke sini'}
                  </p>
                  <p className="text-xs font-bold text-dim mt-1.5">
                    Format JPG atau PNG (Maksimal 50 foto per batch)
                  </p>
                </div>

                <div className="flex justify-end">
                  <sakuga-button
                    type="submit"
                    disabled={uploading || files.length === 0}
                  >
                    {uploading ? 'Proses Unggah & AI Match...' : `Unggah ${files.length} Foto`}
                  </sakuga-button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 sk-card p-12 text-center">
            <p className="font-bold text-dim">
              Pilih acara atau klik “Gabung Acara” dengan kode referral.
            </p>
          </div>
        )}
      </div>

      {/* Modal Gabung Acara */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sk-card w-full max-w-md p-6 space-y-4">
            <div>
              <span className="sk-kicker mb-1.5">参加コード</span>
              <h3 className="text-lg font-extrabold">Gabung Acara Pernikahan</h3>
              <p className="text-xs font-bold text-dim mt-1">
                Masukkan kode referral yang diberikan oleh pemilik acara.
              </p>
            </div>

            {joinError && (
              <div className="sk-alert sk-alert-error" role="alert">
                <span aria-hidden="true">⚠</span>
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinEvent} className="space-y-4">
              <div>
                <div className="sk-field-label">Kode Referral</div>
                <sakuga-input
                  ref={refCodeRef}
                  type="text"
                  name="referral_code"
                  label="Kode referral"
                  placeholder="Contoh: P3X8LM"
                />
                <p className="text-[11px] font-bold text-dim mt-2">
                  Huruf besar akan dibaca sama persis oleh sistem.
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <sakuga-button variant="secondary" onClick={() => setShowJoinModal(false)}>
                  Batal
                </sakuga-button>
                <sakuga-button type="submit">Gabung</sakuga-button>
              </div>
            </form>
          </div>
        </div>
      )}

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
