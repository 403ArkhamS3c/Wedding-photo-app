import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import PemilikDashboard from './pages/PemilikDashboard';
import FotograferDashboard from './pages/FotograferDashboard';
import RegistrasiTamu from './pages/RegistrasiTamu';
import GaleriTamu from './pages/GaleriTamu';
import LupaPassword from './pages/LupaPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  return (
    <Router>
      <div className="min-h-screen font-sans">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/pemilik" element={<PemilikDashboard />} />
          <Route path="/fotografer" element={<FotograferDashboard />} />
          <Route path="/tamu/:guestCode" element={<RegistrasiTamu />} />
          <Route path="/gallery" element={<GaleriTamu />} />
          {/* Dokumen Aplikasi v1.1 — Fitur Lupa Password (W-07, W-08) */}
          <Route path="/lupa-password" element={<LupaPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
