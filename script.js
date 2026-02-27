:root{
  --bg:#0b1220;
  --card:#101a30;
  --alt:#0e1730;
  --text:#e7ecff;
  --muted:#b8c0e6;
  --line:rgba(255,255,255,.08);
  --accent:#22c55e;
  --shadow:0 18px 50px rgba(0,0,0,.35);
  --radius:18px;
}

*{ box-sizing:border-box; }
html{ scroll-behavior:smooth; }
body{
  margin:0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  background: radial-gradient(1200px 600px at 20% 0%, rgba(34,197,94,.18), transparent 55%),
              radial-gradient(1200px 600px at 80% 10%, rgba(56,189,248,.14), transparent 55%),
              var(--bg);
  color:var(--text);
}

a{ color:inherit; text-decoration:none; }
.container{ width:min(1100px, 92%); margin-inline:auto; }

.topbar{
  border-bottom:1px solid var(--line);
  background: rgba(0,0,0,.25);
}
.topbar__inner{
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 0;
  gap:10px;
  color:var(--muted);
  font-size:14px;
}
.topbar__links{ display:flex; gap:14px; }

.header{
  position:sticky; top:0; z-index:10;
  backdrop-filter: blur(10px);
  background: rgba(11,18,32,.65);
  border-bottom:1px solid var(--line);
}
.header__inner{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 0;
}
.brand{ display:flex; align-items:center; gap:10px; }
.brand__logo{
  width:34px; height:34px;
  display:grid; place-items:center;
  border-radius:12px;
  background: rgba(34,197,94,.15);
  border:1px solid rgba(34,197,94,.35);
}
.brand__name{ font-weight:700; letter-spacing:.3px; }

.nav{ display:flex; align-items:center; gap:14px; }
.nav a{
  color:var(--muted);
  padding:10px 10px;
  border-radius:12px;
}
.nav a:hover{ background: rgba(255,255,255,.06); color:var(--text); }

.menuBtn{
  display:none;
  border:1px solid var(--line);
  background: rgba(255,255,255,.06);
  color:var(--text);
  padding:10px 12px;
  border-radius:12px;
  font-size:18px;
}

.hero{ padding:56px 0 26px; }
.hero__grid{
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap:26px;
  align-items:start;
}
.hero__text h1{
  font-size: clamp(28px, 4vw, 46px);
  line-height:1.05;
  margin:0 0 12px;
}
.hero__text p{
  margin:0 0 18px;
  color:var(--muted);
  font-size:18px;
  line-height:1.5;
}
.hero__actions{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.hero__badges{ display:flex; gap:10px; flex-wrap:wrap; }

.badge{
  border:1px solid var(--line);
  background: rgba(255,255,255,.05);
  padding:8px 10px;
  border-radius:999px;
  color:var(--muted);
  font-size:13px;
}

.section{ padding:56px 0; }
.section--alt{
  background: linear-gradient(180deg, transparent, rgba(255,255,255,.03), transparent);
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
}
.section__head{ margin-bottom:18px; }
.section__head h2{ margin:0 0 6px; font-size:28px; }
.section__head p{ margin:0; color:var(--muted); }

.grid{
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap:14px;
}
.card{
  background: rgba(16,26,48,.82);
  border:1px solid var(--line);
  border-radius: var(--radius);
  padding:16px;
  box-shadow: var(--shadow);
}
.card h3{ margin:0 0 8px; }
.card p, .card blockquote, .card figcaption{ color:var(--muted); }

.hero__card{
  background: rgba(16,26,48,.9);
  border:1px solid var(--line);
  border-radius: var(--radius);
  padding:18px;
  box-shadow: var(--shadow);
}
.hero__card h3{ margin:0 0 6px; }
.hero__card p{ margin:0 0 14px; color:var(--muted); }

label{ display:grid; gap:6px; margin-bottom:12px; color:var(--muted); font-size:14px; }
input, select{
  width:100%;
  padding:12px 12px;
  border-radius:14px;
  border:1px solid var(--line);
  background: rgba(255,255,255,.04);
  color:var(--text);
  outline:none;
}
input::placeholder{ color: rgba(231,236,255,.55); }
small.muted, .muted{ color:var(--muted); }
.btn{
  display:inline-flex; align-items:center; justify-content:center;
  border:none;
  border-radius:14px;
  padding:12px 14px;
  background: var(--accent);
  color:#04130a;
  font-weight:700;
  cursor:pointer;
}
.btn--ghost{
  background: rgba(255,255,255,.06);
  border:1px solid var(--line);
  color:var(--text);
}
.btn--small{ padding:10px 12px; border-radius:12px; }

.about{
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap:16px;
  align-items:start;
}
.list{ margin:12px 0 0; padding-left:18px; color:var(--muted); }
.stats{
  display:grid;
  gap:12px;
}
.stat{
  background: rgba(16,26,48,.82);
  border:1px solid var(--line);
  border-radius: var(--radius);
  padding:16px;
}
.stat strong{ font-size:30px; display:block; }
.stat span{ color:var(--muted); }

.faq{ display:grid; gap:12px; }
.faq__item{
  background: rgba(16,26,48,.82);
  border:1px solid var(--line);
  border-radius: var(--radius);
  padding:14px 16px;
}
.faq__item summary{ cursor:pointer; font-weight:700; }
.faq__item p{ margin:10px 0 0; color:var(--muted); }

.contact{
  display:grid;
  grid-template-columns: 1.1fr .9fr;
  gap:14px;
  align-items:start;
}
.contact__buttons{ display:flex; gap:10px; flex-wrap:wrap; margin:12px 0; }

.footer{
  border-top:1px solid var(--line);
  padding:18px 0;
  color:var(--muted);
}
.footer__inner{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.footer__links{ display:flex; gap:12px; }

.whatsFloat{
  position:fixed;
  right:18px; bottom:18px;
  width:52px; height:52px;
  display:grid; place-items:center;
  border-radius:16px;
  background: var(--accent);
  color:#04130a;
  font-size:22px;
  box-shadow: var(--shadow);
  border: none;
}

/* Responsive */
@media (max-width: 920px){
  .grid{ grid-template-columns: repeat(2, 1fr); }
  .hero__grid, .about, .contact{ grid-template-columns: 1fr; }
  .menuBtn{ display:inline-flex; }
  .nav{
    position: absolute;
    right: 4%;
    top: 60px;
    width: min(320px, 92vw);
    display:none;
    flex-direction:column;
    padding:12px;
    border-radius:16px;
    background: rgba(16,26,48,.95);
    border:1px solid var(--line);
    box-shadow: var(--shadow);
  }
  .nav.open{ display:flex; }
  .topbar__links{ display:none; }
}
