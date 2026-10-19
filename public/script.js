
/* ====== CONFIG: paste your Supabase project values ====== */
const SUPABASE_URL = 'https://rxyvbqtrdntqueokcvsl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4eXZicXRyZG50cXVlb2tjdnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzk1NzUsImV4cCI6MjEwNzkxNTU3NX0.MO3x4nNzlnJ9laJ_u73j2KY05iSyMjzqj2vu2uYPil4';
/* ======================================================== */

const $ = (id) => document.getElementById(id);
const slug = (new URLSearchParams(location.search).get('s') ||
    location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();

async function rpc(fn, args, keepalive) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        keepalive: !!keepalive,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(args)
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

const naira = (n) => '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 });
const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : null;

function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
        if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
    });
    kids.forEach((k) => k && n.append(k));
    return n;
}

function bagIcon() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '32'); s.setAttribute('height', '32'); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
    s.setAttribute('aria-hidden', 'true'); s.style.color = 'var(--accent)';
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M6 8h12l1 12H5z M9 8a3 3 0 016 0'); s.append(p);
    return s;
}

let vendor = null, products = [], activeCat = 'All';

function waLink(text) {
    return `https://wa.me/${vendor.whatsapp_number}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

function card(p) {
    const img = safeUrl(p.image_url);
    const thumb = el('div', { class: 'thumb' }, img ? el('img', { src: img, alt: p.name, loading: 'lazy' }) : bagIcon());
    const info = el('div', { class: 'info' }, el('div', { class: 'name', text: p.name }), el('div', { class: 'price', text: naira(p.price) }));
    let btn;
    if (p.in_stock) {
        btn = el('a', {
            class: 'btn', target: '_blank', rel: 'noopener', text: 'Order on WhatsApp',
            href: waLink(`Hi, I want to order ${p.name} - ${naira(p.price)} from your price list`)
        });
        btn.addEventListener('click', () => { rpc('track_tap', { p_slug: slug, p_product_id: p.id }, true).catch(() => { }); });
    } else {
        btn = el('span', { class: 'btn', 'aria-disabled': 'true', text: 'Out of stock' });
    }
    info.append(btn);
    return el('div', { class: p.in_stock ? 'card' : 'card out' }, thumb, info);
}

function render() {
    const q = $('q').value.trim().toLowerCase();
    const list = products.filter((p) =>
        (activeCat === 'All' || p.category === activeCat) && (!q || p.name.toLowerCase().includes(q)));
    const grid = $('grid');
    grid.replaceChildren(...list.map(card));
    const empty = $('empty');
    if (!list.length) {
        empty.hidden = false;
        empty.replaceChildren(el('h2', { text: products.length ? 'No matches' : 'No products yet' }),
            el('div', { text: products.length ? 'Try a different search or category.' : 'This vendor has not added products yet.' }));
    } else empty.hidden = true;
}

function buildChips() {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    const box = $('chips');
    if (cats.length < 2) { box.hidden = true; return; }
    ['All', ...cats].forEach((c) => {
        const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(c === activeCat), text: c });
        b.addEventListener('click', () => {
            activeCat = c;
            box.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x.textContent === c)));
            render();
        });
        box.append(b);
    });
}

function showMessage(title, text) {
    $('biz').textContent = 'PriceLink';
    $('grid').replaceChildren();
    const m = $('empty'); m.hidden = false;
    m.replaceChildren(el('h2', { text: title }), el('div', { text }));
}

async function init() {
    if (!slug) return showMessage('No vendor link', 'Open a link like pricelink.ng/yourshop.');
    try {
        const data = await rpc('get_public_page', { p_slug: slug });
        if (!data) return showMessage('Page not found', 'Check the link and try again.');
        vendor = data.vendor; products = data.products;
    } catch (e) {
        return showMessage('Could not load prices', 'Check your connection and refresh.');
    }
    document.title = `${vendor.business_name} | Price list`;
    $('biz').textContent = vendor.business_name;
    $('meta').textContent = [vendor.tagline, vendor.city].filter(Boolean).join(' · ');
    const logo = safeUrl(vendor.logo_url);
    $('logo').replaceChildren(logo ? el('img', { src: logo, alt: '' }) : document.createTextNode(initials(vendor.business_name)));
    $('chat').href = waLink(`Hi ${vendor.business_name}, I have a question about your price list`);
    $('bar').hidden = false;
    $('mark').hidden = vendor.plan === 'pro';
    $('tools').hidden = false;
    buildChips();
    $('q').addEventListener('input', render);
    render();
    try {
        const key = 'pl_viewed_' + slug;
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            rpc('track_view', { p_slug: slug, p_referrer: document.referrer || null }).catch(() => { });
        }
    } catch (e) {
        rpc('track_view', { p_slug: slug, p_referrer: document.referrer || null }).catch(() => { });
    }
}
init();
