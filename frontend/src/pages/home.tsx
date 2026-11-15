import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileCode2,
  FolderGit2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <>
      <section className="jx-landing-hero">
        <h1>
          Bukan hanya apa yang kamu tahu.
          <br />
          Tunjukkan apa yang kamu buat.
        </h1>
        <p>
          Karya punya cerita. JobX membantu menghubungkan artifact, bukti skill,
          dan kebutuhan pekerjaan agar peluang dimulai dari hal yang lebih
          nyata.
        </p>
        <div className="jx-actions">
          <Link className="jx-button primary" to="/account?mode=register">
            Mulai sebagai kandidat
            <ArrowRight size={15} />
          </Link>
          <Link className="jx-button" to="/account?mode=register&role=employer">
            Saya mencari talenta
          </Link>
        </div>
        <small className="jx-hero-note">
          Berbasis evidence. Dibantu AI. Diputuskan manusia.
        </small>
        <div className="jx-landing-proof">
          <div className="jx-proof-bar">
            <span>JobX / Dari karya ke peluang</span>
            <span>Ilustrasi alur produk</span>
          </div>
          <div className="jx-proof-columns">
            <div className="jx-proof-column">
              <span className="jx-record-icon">
                <FolderGit2 size={21} />
              </span>
              <h2>Mulai dari karya</h2>
              <p>
                Repository, dokumen, atau tautan project. Tambahkan konteks
                tentang apa yang kamu kerjakan.
              </p>
              <span className="jx-badge lavender">Artifact + kontribusi</span>
            </div>
            <div className="jx-proof-column">
              <span className="jx-record-icon">
                <Sparkles size={21} />
              </span>
              <h2>Skill dengan sumber</h2>
              <p>
                Tinjau saran skill, kutipan, serta lokasi evidence. Konfirmasi
                yang sesuai, tolak yang tidak.
              </p>
              <span className="jx-badge mint">
                <Check size={11} />
                Bisa ditinjau
              </span>
            </div>
            <div className="jx-proof-column">
              <span className="jx-record-icon">
                <BriefcaseBusiness size={21} />
              </span>
              <h2>Peluang yang relevan</h2>
              <p>
                Bandingkan bukti dengan kebutuhan pekerjaan. Pahami alasan
                kecocokan sebelum menyatakan minat.
              </p>
              <span className="jx-badge peach">Ketertarikan dua arah</span>
            </div>
          </div>
        </div>
      </section>
      <section className="jx-landing-section" id="cara-kerja">
        <h2>
          Daftar skill bercerita sedikit.
          <br />
          Bukti memberi konteks.
        </h2>
        <p>
          Project kecil tetap bisa menunjukkan cara berpikir, kontribusi, dan
          penerapan skill. JobX menempatkan sumber bukti di dekat setiap saran,
          bukan menyembunyikannya di balik skor.
        </p>
        <div className="jx-grid">
          <div className="jx-record">
            <span className="jx-record-icon">
              <FileCode2 size={21} />
            </span>
            <h3>Konteks, bukan klaim tanpa sumber.</h3>
            <p>
              Evidence menyertakan kutipan atau lokasi yang bisa diperiksa.
              Bedakan penggunaan langsung dengan kesimpulan model.
            </p>
          </div>
          <div className="jx-record">
            <span className="jx-record-icon">
              <ShieldCheck size={21} />
            </span>
            <h3>Kendali tetap milikmu.</h3>
            <p>
              Tentukan visibilitas artifact dan tinjau hasil analisis.
              Confidence AI bukan nilai kemampuan, dan skor match bukan peluang
              diterima.
            </p>
          </div>
        </div>
      </section>
      <section className="jx-landing-section" id="untuk-perusahaan">
        <div className="jx-employer-band">
          <div>
            <h2>
              Mulai dari masalah bisnis.
              <br />
              Bukan daftar syarat panjang.
            </h2>
            <p>
              Jelaskan kebutuhan tim. Susun draft deskripsi pekerjaan dengan
              bantuan AI, tinjau skill yang dibutuhkan, lalu temukan kandidat
              melalui evidence relevan.
            </p>
            <Link
              className="jx-button primary"
              to="/account?mode=register&role=employer"
            >
              Bangun peluang untuk tim
              <ArrowRight size={14} />
            </Link>
          </div>
          <article className="jx-record">
            <span className="jx-badge lavender">Alur employer</span>
            <h3>Kebutuhan → draft → review</h3>
            <p>
              Deskripsi pekerjaan bisa diedit. Publikasi tidak dilakukan
              otomatis setelah draft dibuat.
            </p>
            <div className="jx-notice">
              <Check size={16} />
              <p>Keputusan rekrutmen tetap di tangan tim Anda.</p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
