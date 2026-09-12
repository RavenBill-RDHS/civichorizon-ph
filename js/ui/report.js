export function renderReport(r){
  return `<div class="report-head"><div><div class="eyebrow">LOCATION REPORT</div><p class="sub">Public-source interpretation generated from the current CivicHorizon evidence set.</p></div><div class="language-toggle" role="group" aria-label="Report language">
    <button type="button" class="lang-btn ${r.language==='en'?'active':''}" data-report-lang="en">English</button>
    <button type="button" class="lang-btn ${r.language==='tl'?'active':''}" data-report-lang="tl">Tagalog</button>
    <button type="button" class="lang-btn ${r.language==='zh'?'active':''}" data-report-lang="zh">中文</button>
  </div></div>
  <div class="report-text">${esc(r.text)}</div><div class="source">Report provider: ${esc(r.provider)} · Language: ${label(r.language)}</div>`;
}
function label(v){return ({en:'English',tl:'Tagalog',zh:'Simplified Chinese'})[v]||'English';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
