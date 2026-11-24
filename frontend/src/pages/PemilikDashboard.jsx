import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Copy, Check, QrCode, Image as ImageIcon, Users, RefreshCw, LogOut, Download } from 'lucide-react';
import { useSakugaToast, readSakugaValue } from '../lib/sakuga';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function PemilikDashboard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [stats, setStats] = useState({ guests: 0, photos: 0, processed: 0 });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Form Buat Acara Baru
  const [showForm, setShowForm] = useState(false);
  const [eventDate, setEventDate] = useState('');

  const eventNameRef = useRef(null);
  const progressRef = useRef(null);
  const { ref: toastRef, show } = useSakugaToast();

  // Progres pemrosesan digerakkan <sakuga-progress>
  const progressPercentage = stats.photos > 0 ? Math.round((stats.processed / stats.photos) * 100) : 0;
  useEffect(() => {
    const el = progressRef.current;
    if (el && typeof el.set === 'function') el.set(progressPercentage / 100);
  }, [progressPercentage]);

  // Fetch daftar acara milik pengguna
  const fetchEvents = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) {
      window.location.href = '/';
      return;
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data.length > 0) {
      setEvents(data);
      setSelectedEvent(data[0]);
    }
    setLoading(false);
  };

  // Fetch statistik dan galeri foto acara
  const fetchEventDetails = async (eventId) => {
    // 1. Hitung Tamu Terdaftar
    const { count: guestCount } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    // 2. Hitung Total Foto & Foto Diproses
    const { data: photoData } = await supabase
      .from('photos')
      .select('id, photo_path, processed')
      .eq('event_id', eventId);

    const totalPhotos = photoData ? photoData.length : 0;
    const processedPhotos = photoData ? photoData.filter(p => p.processed).length : 0;

    setStats({
      guests: guestCount || 0,
      photos: totalPhotos,
      processed: processedPhotos
    });

    // 3. Ambil URL Foto dari Supabase Storage
    if (photoData && photoData.length > 0) {
      const photoUrls = photoData.map(p => {
        const { data } = supabase.storage.from('event-photos').getPublicUrl(p.photo_path);
        return { id: p.id, url: data.publicUrl, processed: p.processed };
      });
      setPhotos(photoUrls);
    } else {
      setPhotos([]);
    }
  };

  // Buat Acara Baru via Backend API
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const eventName = readSakugaValue(eventNameRef).trim();

    if (!eventName) {
      show('Nama acara masih kosong.');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: user.id,
          name: eventName,
          event_date: eventDate
        })
      });

      const result = await response.json();
      if (response.ok) {
        setEventDate('');
        setShowForm(false);
        show('Acara berhasil dibuat! Kode undangan sudah siap.');
        fetchEvents();
      } else {
        show(result.error || 'Gagal membuat acara.');
      }
    } catch (err) {
      show('Gagal membuat acara: ' + err.message);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(type);
    show('Kode disalin!');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Muat daftar acara saat halaman dibuka, lalu detail acara terpilih
  useEffect(() => {
    fetchEvents();

  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventDetails(selectedEvent.id);
    }

  }, [selectedEvent]);

  if (loading) {
    return (
      <div className="sk-loading">
        <div className="sk-spinner" />
        <p>Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header Dashboard */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <span className="sk-kicker mb-2">主催者 · Event Owner</span>
          <h1 className="text-2xl md:text-3xl font-extrabold">Dashboard Pemilik Acara</h1>
          <p className="text-dim text-sm font-medium mt-1">
            Kelola acara dan pantau pencocokan foto tamu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <sakuga-button onClick={() => setShowForm(!showForm)}>
            + Buat Acara Baru
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
        {/* Sidebar Daftar Acara */}
        <div className="lg:col-span-1 sk-card p-4 h-fit">
          <div className="sk-field-label">Daftar Acara Saya</div>
          <div className="space-y-1.5">
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className={`sk-item ${selectedEvent?.id === evt.id ? 'sk-item-active' : ''}`}
              >
                <div className="font-extrabold truncate">{evt.name}</div>
                <div className="text-xs text-dim font-semibold mt-1">
                  {evt.event_date || 'Tanggal belum diatur'}
                </div>
              </button>
            ))}
            {events.length === 0 && (
              <p className="text-xs text-dim font-semibold p-2">
                Belum ada acara. Klik “+ Buat Acara Baru” untuk memulai.
              </p>
            )}
          </div>
        </div>

        {/* Konten Utama Detail Acara (W-02) */}
        {selectedEvent ? (
          <div className="lg:col-span-3 space-y-6">
            {/* Card Kode Acara */}
            <div className="sk-card p-6 space-y-4">
              <div className="flex justify-between items-start border-b-2 border-line pb-4">
                <div>
                  <span className="sk-kicker mb-1.5">イベント · Detail</span>
                  <h2 className="text-xl font-extrabold">{selectedEvent.name}</h2>
                  <p className="text-sm text-dim font-semibold">{selectedEvent.event_date}</p>
                </div>
                <button
                  onClick={() => fetchEventDetails(selectedEvent.id)}
                  aria-label="Segarkan data"
                  className="sk-btn-ghost"
                  style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}
                >
                  <RefreshCw size={17} />
                </button>
              </div>

              {/* Grid Kode Tamu & Kode Fotografer (W-02) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kode Tamu */}
                <div className="sk-card-soft p-4">
                  <div className="sk-field-label mb-2">Kode Tamu (Undangan)</div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="sk-code text-lg">{selectedEvent.guest_code}</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => copyToClipboard(selectedEvent.guest_code, 'guest')}
                        className="sk-btn-ghost"
                      >
                        {copiedCode === 'guest' ? <Check size={14} /> : <Copy size={14} />}
                        <span>Salin</span>
                      </button>
                      <button
                        onClick={() => setShowQR(!showQR)}
                        className="sk-btn-ghost sk-btn-soft"
                      >
                        <QrCode size={14} />
                        <span>QR</span>
                      </button>
                    </div>
                  </div>
                  {showQR && (
                    <div className="sk-alert sk-alert-warn mt-3 text-xs">
                      <span aria-hidden="true">ℹ</span>
                      <span>
                        Bagikan kode ini ke tamu lewat undangan. Tautan pribadi tamu dibuat
                        otomatis setelah mereka mendaftarkan wajah.
                      </span>
                    </div>
                  )}
                </div>

                {/* Kode Fotografer */}
                <div className="sk-card-soft p-4">
                  <div className="sk-field-label mb-2">Kode Referral Fotografer</div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="sk-code text-lg">{selectedEvent.photographer_code}</span>
                    <button
                      onClick={() => copyToClipboard(selectedEvent.photographer_code, 'photo')}
                      className="sk-btn-ghost"
                    >
                      {copiedCode === 'photo' ? <Check size={14} /> : <Copy size={14} />}
                      <span>Salin</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistik & Progress Bar (W-02) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sk-stat">
                <div className="sk-iconbox sk-iconbox-pri">
                  <Users size={22} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{stats.guests}</div>
                  <div className="text-xs font-bold text-dim">Tamu Terdaftar</div>
                </div>
              </div>

              <div className="sk-stat">
                <div className="sk-iconbox sk-iconbox-acc">
                  <ImageIcon size={22} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{stats.photos}</div>
                  <div className="text-xs font-bold text-dim">Total Foto Acara</div>
                </div>
              </div>

              <div className="sk-stat flex-col items-stretch justify-center gap-1">
                <div className="flex justify-between text-xs font-extrabold mb-1">
                  <span>Progres Pemrosesan</span>
                  <span className="text-acc">{progressPercentage}%</span>
                </div>
                <sakuga-progress
                  ref={progressRef}
                  label="Progres pemrosesan foto"
                  done-label="Selesai ✓"
                />
                <div className="text-[10px] font-bold text-dim mt-1 text-right">
                  {stats.processed} dari {stats.photos} foto diproses
                </div>
              </div>
            </div>

            {/* Galeri Seluruh Foto Acara (W-02) */}
            <div className="sk-card p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold flex items-center gap-2">
                  <ImageIcon size={18} className="text-acc" />
                  Galeri Seluruh Foto Acara
                </h3>
                <span className="text-xs font-bold text-dim">{photos.length} foto tersedia</span>
              </div>

              {photos.length === 0 ? (
                <div className="sk-card-soft py-12 px-6 text-center">
                  <ImageIcon size={40} className="mx-auto text-soft mb-3" />
                  <p className="text-sm font-bold text-dim">
                    Belum ada foto yang diunggah oleh fotografer.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="sk-photo aspect-square">
                      <img
                        src={photo.url}
                        alt="Foto Acara"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-ink/45 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-2">
                        <a
                          href={photo.url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Unduh foto"
                          className="w-10 h-10 grid place-items-center bg-card text-ink rounded-full border-2 border-ink"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 sk-card p-12 text-center">
            <p className="font-bold text-dim">Pilih atau buat acara untuk melihat detail.</p>
          </div>
        )}
      </div>

      {/* Modal Buat Acara Baru */}
      {showForm && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sk-card w-full max-w-md p-6 space-y-4">
            <div>
              <span className="sk-kicker mb-1.5">新規イベント</span>
              <h3 className="text-lg font-extrabold">Buat Acara Pernikahan Baru</h3>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <div className="sk-field-label">Nama Acara</div>
                <sakuga-input
                  ref={eventNameRef}
                  type="text"
                  name="event_name"
                  label="Nama acara"
                  placeholder="Contoh: Pernikahan Budi & Ani"
                />
              </div>
              <div>
                <div className="sk-field-label">Tanggal Acara</div>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="sk-input"
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <sakuga-button variant="secondary" onClick={() => setShowForm(false)}>
                  Batal
                </sakuga-button>
                <sakuga-button type="submit">Simpan Acara</sakuga-button>
              </div>
            </form>
          </div>
        </div>
      )}

      <sakuga-toast ref={toastRef} style={{ position: 'fixed', right: 24, bottom: 24 }} />
    </div>
  );
}
