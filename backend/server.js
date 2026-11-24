require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE & INISIALISASI
// ==========================================
app.use(cors());
app.use(express.json());

// Konfigurasi multer untuk menyimpan file sementara di memori (RAM)
const upload = multer({ storage: multer.memoryStorage() });

// Inisialisasi Supabase Client (Service Role Key untuk akses penuh bypass RLS)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==========================================
// ENDPOINT: HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running', supabase: !!supabase });
});

// ==========================================
// ENDPOINT: MEMBUAT ACARA (PEMILIK ACARA)
// ==========================================
// Membuat acara dan sistem menghasilkan kode unik secara otomatis[cite: 6, 43]
app.post('/api/events', async (req, res) => {
    const { owner_id, name, event_date } = req.body;

    // Sistem membuat otomatis kode tamu dan kode referral fotografer yang unik[cite: 6]
    const guest_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const photographer_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
        .from('events')
        .insert([{ owner_id, name, event_date, guest_code, photographer_code }])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Acara berhasil dibuat', data });
});

// ==========================================
// ENDPOINT: REGISTRASI WAJAH TAMU
// ==========================================
// Daftar wajah tamu dan mengembalikan tautan pribadi[cite: 43]
app.post('/api/guests/register', upload.single('selfie'), async (req, res) => {
    const { guest_code, name } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'Selfie wajib diunggah' });

    try {
        // 1. Validasi kode tamu yang dimasukkan
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id')
            .eq('guest_code', guest_code)
            .single();

        if (eventError || !event) {
            return res.status(404).json({ error: 'Kode tamu tidak valid' });
        }

        // 2. Kirim selfie ke Service Python (POST /encode) untuk ekstraksi embedding[cite: 43]
        const formData = new FormData();
        formData.append('selfie', file.buffer, file.originalname);

        const pythonResponse = await axios.post(`${process.env.FACE_SERVICE_URL}/encode`, formData, {
            headers: formData.getHeaders()
        });

        // Hasil dari service Python: array angka (vektor embedding wajah)[cite: 15]
        const embedding = pythonResponse.data.embedding;

        // 3. Upload file fisik ke Supabase Storage di bucket 'guest-selfies'
        const filePath = `${event.id}/${Date.now()}_${file.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('guest-selfies')
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw uploadError;

        // 4. Buat token akses pribadi untuk tamu membuka galerinya nanti[cite: 11]
        const access_token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // 5. Simpan data tamu ke tabel guests dan catat waktu persetujuan (consent_at)[cite: 18]
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .insert([{ 
                event_id: event.id, 
                name, 
                access_token, 
                consent_at: new Date().toISOString() 
            }])
            .select().single();

        if (guestError) throw guestError;

        // 6. Simpan URL foto dan embedding vektor ke tabel guest_faces[cite: 18]
        // pgvector PostgreSQL menerima format string array: '[0.12, 0.45, ...]'
        const { error: faceError } = await supabase
            .from('guest_faces')
            .insert([{ 
                guest_id: guest.id, 
                selfie_path: filePath, 
                embedding: `[${embedding}]` 
            }]);

        if (faceError) throw faceError;

        // Berhasil dan tautan pribadi diberikan[cite: 15]
        res.json({ 
            message: 'Registrasi berhasil', 
            access_token,
            gallery_url: `/gallery?token=${access_token}`
        });

    } catch (error) {
        // Menangkap error, termasuk jika kualitas selfie kurang dari service Python[cite: 15]
        const errMsg = error.response?.data?.detail || error.message;
        res.status(500).json({ error: errMsg });
    }
});

// ==========================================
// ENDPOINT: FOTOGRAFER MENGUNGGAH FOTO ACARA
// ==========================================
// Menggunakan upload.array untuk menerima banyak foto sekaligus (maksimal 50 per batch)
app.post('/api/photos/upload', upload.array('photos', 50), async (req, res) => {
    const { event_id, uploader_id } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Tidak ada foto yang diunggah' });
    }

    // Mengambil nilai threshold dari environment variable (.env)[cite: 40]
    const threshold = parseFloat(process.env.MATCH_THRESHOLD || 0.6);
    let processedCount = 0;

    // Respon segera dikembalikan agar fotografer tidak menunggu lama (opsional, pemrosesan berjalan di background)[cite: 3]
    res.json({ message: 'Foto diterima, pemrosesan berjalan di latar belakang', total: files.length });

    // Loop pemrosesan setiap foto yang diunggah
    for (const file of files) {
        try {
            // A. Simpan foto acara ke Supabase Storage (bucket event-photos)[cite: 39]
            const filePath = `${event_id}/${Date.now()}_${file.originalname}`;
            const { error: uploadError } = await supabase.storage
                .from('event-photos')
                .upload(filePath, file.buffer, { contentType: file.mimetype });

            if (uploadError) continue; // Lewati jika gagal unggah

            // B. Catat baris di tabel photos dengan status processed = false[cite: 44]
            const { data: photoRec, error: photoError } = await supabase
                .from('photos')
                .insert([{ event_id, uploaded_by: uploader_id, photo_path: filePath, processed: false }])
                .select().single();

            if (photoError) continue;

            // C. Kirim foto ke Service Python untuk deteksi multi-wajah[cite: 15, 44]
            const formData = new FormData();
            formData.append('foto', file.buffer, file.originalname);

            const pythonResponse = await axios.post(`${process.env.FACE_SERVICE_URL}/detect-multiple`, formData, {
                headers: formData.getHeaders()
            });

            const embeddings = pythonResponse.data.embeddings || [];

            // D. Jika ada wajah, cocokkan tiap wajah menggunakan query pgvector[cite: 14]
            for (const embedding of embeddings) {
                // Panggil fungsi RPC match_face yang baru saja kita buat di Supabase
                const { data: matches, error: matchError } = await supabase.rpc('match_face', {
                    query_embedding: `[${embedding}]`,
                    match_event_id: event_id,
                    match_threshold: threshold
                });

                if (matchError || !matches || matches.length === 0) continue;

                // E. Simpan hasil yang melampaui threshold ke photo_matches[cite: 14, 45]
                for (const match of matches) {
                    await supabase
                        .from('photo_matches')
                        .insert([{ 
                            photo_id: photoRec.id, 
                            guest_id: match.guest_id, 
                            similarity: match.similarity 
                        }])
                        // Abaikan jika terjadi duplikasi (unique constraint)[cite: 19]
                        .catch(err => console.log('Duplikasi match diabaikan:', err.message));
                }
            }

            // F. Tandai foto selesai diproses[cite: 15, 45]
            await supabase
                .from('photos')
                .update({ processed: true })
                .eq('id', photoRec.id);

            processedCount++;
        } catch (error) {
            console.error(`Gagal memproses foto ${file.originalname}:`, error.message);
        }
    }
    console.log(`Pemrosesan batch selesai: ${processedCount}/${files.length} berhasil diproses.`);
});

// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`Backend berjalan di http://localhost:${PORT}`);
});
