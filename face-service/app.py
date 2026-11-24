import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from deepface import DeepFace

app = FastAPI(title="Face Recognition Service")

# Konfigurasi model sesuai dokumen
MODEL = "ArcFace"
DETECTOR = "retinaface"

def check_quality(img_bgr, blur_min=100.0, bright_min=60, bright_max=200):
    """Mengecek kualitas foto (blur dan pencahayaan)"""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.Laplacian(gray, cv2.CV_64F).var()
    bright = gray.mean()
    
    if blur < blur_min:
        return "blurry"
    if bright < bright_min or bright > bright_max:
        return "too_dark"
    return None

@app.get("/health")
def health_check():
    """Endpoint untuk mengecek status service"""
    return {"status": "ok"}

@app.post("/encode")
async def encode_face(selfie: UploadFile = File(...)):
    """Memproses selfie tamu: validasi kualitas dan ekstraksi 1 embedding"""
    contents = await selfie.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="invalid_image")

    # 1. Cek Kualitas Selfie
    quality_issue = check_quality(img_bgr)
    if quality_issue:
        raise HTTPException(status_code=400, detail=quality_issue)

    try:
        # 2. Ekstraksi Wajah (enforce_detection=True agar error jika tidak ada wajah)
        faces = DeepFace.represent(
            img_path=img_bgr,
            model_name=MODEL,
            detector_backend=DETECTOR,
            enforce_detection=True
        )
        
        # 3. Validasi jumlah wajah di foto selfie
        if len(faces) == 0:
            raise HTTPException(status_code=400, detail="no_face")
        if len(faces) > 1:
            raise HTTPException(status_code=400, detail="multiple_faces")
            
        return {"embedding": faces[0]["embedding"]}
        
    except ValueError as e:
        # Menangkap error bawaan DeepFace jika wajah tidak ditemukan
        if "Face could not be detected" in str(e):
            raise HTTPException(status_code=400, detail="no_face")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect-multiple")
async def detect_multiple(foto: UploadFile = File(...)):
    """Memproses foto acara: mencari semua wajah tanpa validasi kualitas"""
    contents = await foto.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="invalid_image")

    try:
        # enforce_detection=False agar tidak error jika foto pemandangan (tanpa wajah)
        faces = DeepFace.represent(
            img_path=img_bgr,
            model_name=MODEL,
            detector_backend=DETECTOR,
            enforce_detection=False
        )
        
        # Menyaring wajah yang memiliki tingkat kepercayaan deteksi yang layak
        embeddings = []
        for face in faces:
            # DeepFace mengembalikan confidence score jika tersedia
            if face.get("face_confidence", 1.0) > 0.8:
                embeddings.append(face["embedding"])
                
        return {"embeddings": embeddings}
    except Exception as e:
        # Jika ada error atau tidak ada wajah terdeteksi, kembalikan list kosong
        return {"embeddings": []}
