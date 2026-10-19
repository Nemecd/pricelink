/* ====== CONFIG: paste your values ====== */
const CONFIG = {
  SUPABASE_URL: 'https://rxyvbqtrdntqueokcvsl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4eXZicXRyZG50cXVlb2tjdnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzk1NzUsImV4cCI6MjEwNzkxNTU3NX0.MO3x4nNzlnJ9laJ_u73j2KY05iSyMjzqj2vu2uYPil4',
  PUBLIC_BASE_URL: 'https://pricelink.ng',   // your live domain
  UPGRADE_WHATSAPP: '2349027829164'          // your WhatsApp number (digits only) for Pro upgrade requests
};
/* ======================================= */

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const isLocal = location.protocol === 'file:' ||
  ['localhost', '127.0.0.1'].includes(location.hostname);

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  });
  kids.forEach((k) => k && n.append(k));
  return n;
}

const naira = (n) => '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 });
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : null;

// 0801 234 5678 -> 2348012345678. Returns null if it does not look like a valid number.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  return /^[0-9]{10,15}$/.test(d) ? d : null;
}

// Public page address for a vendor. Locally it points at index.html one folder up (app lives inside public).
function pageUrl(slug) {
  return isLocal ? `../index.html?s=${encodeURIComponent(slug)}`
                 : `${CONFIG.PUBLIC_BASE_URL}/${slug}`;
}

let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 4000);
}

function bagIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '24');
  s.setAttribute('height', '24');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('aria-hidden', 'true');
  s.style.color = 'var(--accent)';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M6 8h12l1 12H5z M9 8a3 3 0 016 0');
  s.append(p);
  return s;
}