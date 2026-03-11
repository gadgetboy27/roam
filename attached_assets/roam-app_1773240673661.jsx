import { useState, useEffect } from "react";

const GOOGLE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap');
`;

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --forest: #111a10;
    --moss: #1e2e1c;
    --sage: #3d5c38;
    --fern: #5a7a54;
    --cream: #f2ede3;
    --sand: #d9cdb8;
    --electric: #c8e64a;
    --ember: #e8621a;
    --sky: #7db8d4;
    --mist: rgba(242,237,227,0.06);
  }

  body { 
    background: var(--forest); 
    color: var(--cream);
    font-family: 'Outfit', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .topo-bg {
    position: fixed; inset: 0; z-index: 0;
    background-image: 
      repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px),
      repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px);
    pointer-events: none;
  }

  .app { position: relative; z-index: 1; max-width: 420px; margin: 0 auto; min-height: 100vh; }

  /* NAV */
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(242,237,227,0.08);
    position: sticky; top: 0; z-index: 100;
    background: rgba(17,26,16,0.92);
    backdrop-filter: blur(12px);
  }
  .nav-logo { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 900; letter-spacing: -1px; }
  .logo-dot { color: var(--electric); }
  .nav-tabs { display: flex; gap: 4px; }
  .nav-tab {
    padding: 7px 14px; border-radius: 20px; font-size: 12px;
    font-family: 'DM Mono', monospace; letter-spacing: 0.5px; text-transform: uppercase;
    cursor: pointer; border: none; transition: all 0.2s;
    background: transparent; color: rgba(242,237,227,0.4);
  }
  .nav-tab.active { background: var(--electric); color: var(--forest); font-weight: 500; }

  /* MATCH CARD */
  .match-card {
    margin: 20px 16px;
    border-radius: 20px;
    overflow: hidden;
    background: var(--moss);
    border: 1px solid rgba(242,237,227,0.08);
    position: relative;
  }

  .card-photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 200px 120px;
    gap: 2px;
  }

  .photo-cell {
    position: relative;
    overflow: hidden;
    background: var(--sage);
  }
  .photo-cell:first-child { grid-row: 1 / 3; }
  .photo-cell img { width: 100%; height: 100%; object-fit: cover; }

  .photo-tag {
    position: absolute; bottom: 8px; left: 8px;
    background: rgba(17,26,16,0.85);
    border: 1px solid rgba(200,230,74,0.4);
    color: var(--electric);
    font-family: 'DM Mono', monospace;
    font-size: 9px; letter-spacing: 0.5px;
    padding: 3px 7px; border-radius: 10px;
    backdrop-filter: blur(8px);
  }

  .card-body { padding: 18px 18px 14px; }
  .card-name { 
    font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700;
    display: flex; align-items: baseline; gap: 10px;
  }
  .card-age { font-size: 14px; font-family: 'Outfit', sans-serif; font-weight: 300; color: var(--sand); }
  .card-tagline { 
    font-size: 13px; color: rgba(242,237,227,0.55); margin-top: 4px;
    font-style: italic; font-family: 'Outfit', sans-serif;
  }

  .adventure-dna {
    margin: 14px 0;
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .dna-tag {
    padding: 5px 10px; border-radius: 12px; font-size: 11px;
    font-family: 'DM Mono', monospace; letter-spacing: 0.3px;
    border: 1px solid; cursor: default;
  }
  .dna-tag.overlap { 
    background: rgba(200,230,74,0.12); 
    border-color: rgba(200,230,74,0.5); 
    color: var(--electric); 
  }
  .dna-tag.theirs { 
    background: rgba(125,184,212,0.08); 
    border-color: rgba(125,184,212,0.3); 
    color: var(--sky);
  }

  .overlap-meter {
    background: rgba(242,237,227,0.05);
    border-radius: 12px;
    padding: 12px 14px;
    margin: 12px 0;
    border: 1px solid rgba(242,237,227,0.06);
  }
  .overlap-label {
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'DM Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: rgba(242,237,227,0.4); margin-bottom: 8px;
  }
  .overlap-pct { color: var(--electric); font-size: 14px; font-weight: 500; }
  .meter-bar { height: 4px; background: rgba(242,237,227,0.08); border-radius: 2px; overflow: hidden; }
  .meter-fill { 
    height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, var(--electric), var(--sky));
    transition: width 1s ease;
  }

  .almost-met {
    background: rgba(232,98,26,0.1);
    border: 1px solid rgba(232,98,26,0.3);
    border-radius: 10px;
    padding: 10px 12px;
    margin: 10px 0;
    display: flex; align-items: flex-start; gap: 8px;
  }
  .almost-met-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .almost-met-text { font-size: 12px; color: rgba(242,237,227,0.75); line-height: 1.5; }
  .almost-met-text strong { color: var(--ember); }

  .card-actions {
    display: flex; gap: 10px; margin-top: 14px;
  }
  .btn-pass {
    flex: 1; padding: 13px; border-radius: 14px;
    background: rgba(242,237,227,0.06);
    border: 1px solid rgba(242,237,227,0.1);
    color: rgba(242,237,227,0.5);
    font-family: 'DM Mono', monospace; font-size: 12px;
    text-transform: uppercase; letter-spacing: 1px;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-pass:hover { background: rgba(242,237,227,0.1); color: var(--cream); }
  .btn-roam {
    flex: 2; padding: 13px; border-radius: 14px;
    background: var(--electric);
    border: none;
    color: var(--forest);
    font-family: 'DM Mono', monospace; font-size: 12px;
    text-transform: uppercase; letter-spacing: 1px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-roam:hover { background: #d4f050; transform: translateY(-1px); }

  /* UPLOAD SCREEN */
  .upload-header {
    padding: 24px 20px 8px;
  }
  .upload-title {
    font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900;
    line-height: 1.1;
  }
  .upload-title em { color: var(--electric); font-style: italic; }
  .upload-sub {
    font-size: 13px; color: rgba(242,237,227,0.5); margin-top: 8px; line-height: 1.6;
  }

  .rules-strip {
    margin: 16px 16px 0;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(242,237,227,0.08);
  }
  .rule {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: rgba(242,237,227,0.03);
    border-bottom: 1px solid rgba(242,237,227,0.05);
    font-size: 12px; color: rgba(242,237,227,0.65);
  }
  .rule:last-child { border-bottom: none; }
  .rule-icon { font-size: 18px; flex-shrink: 0; }
  .rule-bad { color: rgba(232,98,26,0.7); }

  .photo-grid-upload {
    margin: 16px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .upload-cell {
    aspect-ratio: 1;
    border-radius: 10px;
    border: 1.5px dashed rgba(242,237,227,0.15);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
    position: relative; overflow: hidden;
    background: rgba(242,237,227,0.02);
  }
  .upload-cell:hover { border-color: var(--electric); background: rgba(200,230,74,0.04); }
  .upload-cell.filled { border: none; }
  .upload-cell.filled img { width: 100%; height: 100%; object-fit: cover; }
  .upload-cell-label { font-size: 10px; font-family: 'DM Mono', monospace; color: rgba(242,237,227,0.3); margin-top: 6px; letter-spacing: 0.5px; }
  .upload-cell-icon { font-size: 20px; opacity: 0.3; }

  .ai-tag-overlay {
    position: absolute; bottom: 5px; left: 5px; right: 5px;
    display: flex; flex-wrap: wrap; gap: 3px;
  }
  .ai-tag {
    background: rgba(17,26,16,0.88); color: var(--electric);
    font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.3px;
    padding: 2px 5px; border-radius: 6px;
    border: 1px solid rgba(200,230,74,0.3);
  }

  .rejected-notice {
    margin: 0 16px 16px;
    background: rgba(232,98,26,0.08);
    border: 1px solid rgba(232,98,26,0.25);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .rejected-icon { font-size: 18px; flex-shrink: 0; }
  .rejected-text { font-size: 12px; color: rgba(242,237,227,0.65); line-height: 1.5; }
  .rejected-text strong { color: var(--ember); display: block; margin-bottom: 2px; }

  /* MATCHES SCREEN */
  .matches-header { padding: 24px 20px 16px; }
  .matches-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; }
  .match-list { padding: 0 16px 80px; display: flex; flex-direction: column; gap: 10px; }
  .match-row {
    background: var(--moss); border-radius: 16px;
    border: 1px solid rgba(242,237,227,0.06);
    padding: 14px;
    display: flex; gap: 12px; align-items: center;
    cursor: pointer; transition: all 0.2s;
  }
  .match-row:hover { border-color: rgba(200,230,74,0.2); background: rgba(30,46,28,0.8); }
  .match-avatar {
    width: 52px; height: 52px; border-radius: 12px;
    background: var(--sage); overflow: hidden; flex-shrink: 0;
  }
  .match-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .match-info { flex: 1; }
  .match-name { font-size: 16px; font-weight: 600; }
  .match-shared { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--electric); margin-top: 2px; }
  .match-last { font-size: 12px; color: rgba(242,237,227,0.4); margin-top: 3px; }
  .match-score {
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(200,230,74,0.1); border: 1.5px solid rgba(200,230,74,0.4);
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500;
    color: var(--electric); flex-shrink: 0;
  }

  /* BUCKET LIST */
  .bucket-section { padding: 20px 16px 0; }
  .section-label {
    font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1.5px;
    text-transform: uppercase; color: rgba(242,237,227,0.35); margin-bottom: 12px;
  }
  .bucket-scroll {
    display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px;
    scrollbar-width: none;
  }
  .bucket-scroll::-webkit-scrollbar { display: none; }
  .bucket-item {
    flex-shrink: 0; width: 110px;
    border-radius: 14px; overflow: hidden;
    position: relative; cursor: pointer;
    border: 1px solid rgba(242,237,227,0.08);
  }
  .bucket-img { width: 110px; height: 110px; object-fit: cover; display: block; background: var(--sage); }
  .bucket-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(17,26,16,0.85) 0%, transparent 60%);
    display: flex; flex-direction: column; justify-content: flex-end; padding: 8px;
  }
  .bucket-name { font-size: 11px; font-weight: 600; line-height: 1.2; }
  .bucket-want { 
    font-size: 9px; font-family: 'DM Mono', monospace; letter-spacing: 0.3px;
    color: var(--sky); margin-top: 2px;
  }
  .bucket-match-badge {
    position: absolute; top: 7px; right: 7px;
    background: var(--electric); color: var(--forest);
    font-family: 'DM Mono', monospace; font-size: 8px; font-weight: 500;
    padding: 2px 5px; border-radius: 6px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .anim { animation: fadeUp 0.4s ease forwards; }
  .anim-2 { animation: fadeUp 0.4s 0.1s ease both; }
  .anim-3 { animation: fadeUp 0.4s 0.2s ease both; }
`;

const profiles = [
  {
    name: "Mia", age: 29,
    tagline: "Chasing elevation and good coffee",
    overlap: 74,
    photos: [
      { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400", tag: "alpine hiking" },
      { url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300", tag: "glacier lake" },
      { url: "https://images.unsplash.com/photo-1510797215324-95aa89f43c33?w=300", tag: "mountain hut" },
    ],
    sharedTags: ["alpine hiking", "night markets", "coastal walks"],
    theirTags: ["glacier camping", "via ferrata"],
    almostMet: { where: "Milford Sound", when: "Jan 2024" },
  },
  {
    name: "Kai", age: 31,
    tagline: "Lost in alleyways, found in waves",
    overlap: 61,
    photos: [
      { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400", tag: "surf break" },
      { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300", tag: "tokyo alley" },
      { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=300", tag: "rooftop bar" },
    ],
    sharedTags: ["night markets", "urban exploration", "surfing"],
    theirTags: ["freediving", "desert camping"],
    almostMet: null,
  }
];

const uploadedPhotos = [
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300", tags: ["alpine", "summit"] },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300", tags: ["night market", "street food"] },
  { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300", tags: ["beach", "coastal"] },
  { url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=300", tags: ["overwater bungalow"] },
  { url: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=300", tags: ["forest trail"] },
];

const bucketList = [
  { name: "Faroe Islands", url: "https://images.unsplash.com/photo-1514168757508-07ffe9ae125b?w=300", matchCount: 3 },
  { name: "Patagonia", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300", matchCount: 7 },
  { name: "Kyoto in autumn", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300", matchCount: 12 },
  { name: "Iceland", url: "https://images.unsplash.com/photo-1516557070061-c3d1653fa646?w=300", matchCount: 5 },
  { name: "Lofoten", url: "https://images.unsplash.com/photo-1552083375-1447ce886485?w=300", matchCount: 2 },
];

const matchList = [
  { name: "Mia, 29", shared: "alpine hiking • night markets", last: "Matched 2h ago", score: 74, url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=100" },
  { name: "Kai, 31", shared: "surfing • urban exploration", last: "Matched yesterday", score: 61, url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=100" },
  { name: "Sam, 27", shared: "forest trails • rooftop bars", last: "Matched 3 days ago", score: 58, url: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=100" },
];

export default function RoamApp() {
  const [tab, setTab] = useState("discover");
  const [profileIdx, setProfileIdx] = useState(0);
  const [meterFill, setMeterFill] = useState(0);
  const [passed, setPassed] = useState(false);

  const profile = profiles[profileIdx % profiles.length];

  useEffect(() => {
    setMeterFill(0);
    const t = setTimeout(() => setMeterFill(profile.overlap), 300);
    return () => clearTimeout(t);
  }, [profileIdx, tab]);

  useEffect(() => { setPassed(false); }, [profileIdx]);

  const handlePass = () => { setProfileIdx(i => i + 1); };
  const handleRoam = () => { setTab("matches"); };

  return (
    <>
      <style>{GOOGLE_FONTS}{styles}</style>
      <div className="topo-bg" />
      <div className="app">
        <nav className="nav">
          <div className="nav-logo">roam<span className="logo-dot">.</span></div>
          <div className="nav-tabs">
            {["discover","upload","matches"].map(t => (
              <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "discover" ? "🧭" : t === "upload" ? "📸" : "💬"} {t}
              </button>
            ))}
          </div>
        </nav>

        {tab === "discover" && (
          <div className="anim">
            <div className="match-card">
              <div className="card-photo-grid">
                {profile.photos.map((p, i) => (
                  <div className="photo-cell" key={i}>
                    <img src={p.url} alt={p.tag} />
                    <div className="photo-tag">📍 {p.tag}</div>
                  </div>
                ))}
              </div>
              <div className="card-body">
                <div className="card-name">{profile.name} <span className="card-age">{profile.age}</span></div>
                <div className="card-tagline">"{profile.tagline}"</div>

                <div className="adventure-dna">
                  {profile.sharedTags.map(t => <span key={t} className="dna-tag overlap">✓ {t}</span>)}
                  {profile.theirTags.map(t => <span key={t} className="dna-tag theirs">{t}</span>)}
                </div>

                <div className="overlap-meter">
                  <div className="overlap-label">
                    <span>Adventure Overlap</span>
                    <span className="overlap-pct">{meterFill}%</span>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: `${meterFill}%` }} />
                  </div>
                </div>

                {profile.almostMet && (
                  <div className="almost-met">
                    <span className="almost-met-icon">⚡</span>
                    <div className="almost-met-text">
                      You were both at <strong>{profile.almostMet.where}</strong> in {profile.almostMet.when} — you nearly crossed paths.
                    </div>
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn-pass" onClick={handlePass}>Pass</button>
                  <button className="btn-roam" onClick={handleRoam}>✦ Roam Together</button>
                </div>
              </div>
            </div>

            <div className="bucket-section anim-2">
              <div className="section-label">Bucket list matches</div>
              <div className="bucket-scroll">
                {bucketList.map((b, i) => (
                  <div className="bucket-item" key={i}>
                    <img className="bucket-img" src={b.url} alt={b.name} />
                    <div className="bucket-overlay">
                      <div className="bucket-name">{b.name}</div>
                      <div className="bucket-want">wants to go</div>
                    </div>
                    <div className="bucket-match-badge">{b.matchCount} match</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "upload" && (
          <div>
            <div className="upload-header anim">
              <div className="upload-title">Your<br/><em>adventure</em> story</div>
              <div className="upload-sub">Post where you've been and where you're headed. Our AI reads the places — not your face.</div>
            </div>

            <div className="rules-strip anim-2">
              <div className="rule"><span className="rule-icon">🏔️</span> Places, landscapes, food, experiences — yes</div>
              <div className="rule"><span className="rule-icon">🗺️</span> Street scenes, hotels, trail shots — yes</div>
              <div className="rule rule-bad"><span className="rule-icon">🚫</span> Quote graphics & text screenshots — auto-rejected</div>
              <div className="rule rule-bad"><span className="rule-icon">🚫</span> Stock photos & AI-generated images — detected & blocked</div>
              <div className="rule rule-bad"><span className="rule-icon">🚫</span> 5+ selfies in a row — not a mirror app</div>
            </div>

            <div className="photo-grid-upload anim-3">
              {uploadedPhotos.map((p, i) => (
                <div className="upload-cell filled" key={i}>
                  <img src={p.url} alt="uploaded" />
                  <div className="ai-tag-overlay">
                    {p.tags.map(t => <span key={t} className="ai-tag">{t}</span>)}
                  </div>
                </div>
              ))}
              <div className="upload-cell">
                <span className="upload-cell-icon">＋</span>
                <span className="upload-cell-label">add photo</span>
              </div>
              <div className="upload-cell">
                <span className="upload-cell-icon">🗓️</span>
                <span className="upload-cell-label">bucket list</span>
              </div>
            </div>

            <div className="rejected-notice anim-3">
              <span className="rejected-icon">⚠️</span>
              <div className="rejected-text">
                <strong>1 photo rejected</strong>
                AI detected a quote graphic. Roam matches on real places — not someone else's words. Try a photo from where you were when you first read that quote.
              </div>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div>
            <div className="matches-header anim">
              <div className="section-label">Your adventures aligned</div>
              <div className="matches-title">3 new<br/>connections</div>
            </div>
            <div className="match-list">
              {matchList.map((m, i) => (
                <div className="match-row anim" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="match-avatar">
                    <img src={m.url} alt={m.name} />
                  </div>
                  <div className="match-info">
                    <div className="match-name">{m.name}</div>
                    <div className="match-shared">{m.shared}</div>
                    <div className="match-last">{m.last}</div>
                  </div>
                  <div className="match-score">{m.score}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
