const FREE_LIMIT = 10;
let me = null;
let vendor = null;
let products = [];
let editing = null;
let removeImg = false;

function fatal(message) {
  const logout = el('button', { class: 'btn', type: 'button', text: 'Log out' });
  logout.addEventListener('click', doLogout);
  $('main').replaceChildren(el('h1', { text: 'Something went wrong' }), el('p', { text: message }), logout);
}

async function doLogout() {
  await sb.auth.signOut();
  location.replace('login.html');
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return location.replace('login.html');
  me = session.user;

  const { data, error } = await sb.from('vendors').select('*').eq('id', me.id).maybeSingle();
  if (error) return fatal(error.message);
  vendor = data;

  // First login after signup: create the shop profile from the details entered at signup
  if (!vendor) {
    const m = me.user_metadata || {};
    if (!m.slug || !m.business_name || !m.whatsapp_number) {
      return fatal('Your shop profile is missing. Please contact support.');
    }
    const ins = await sb.from('vendors').insert({
      id: me.id, slug: m.slug, business_name: m.business_name, whatsapp_number: m.whatsapp_number
    }).select().single();
    if (ins.error) {
      return fatal(/duplicate|unique/i.test(ins.error.message)
        ? 'Your chosen link was taken just before your account was created. Please contact support to pick another.'
        : ins.error.message);
    }
    vendor = ins.data;
  }

  renderShell();
  await loadProducts();
  loadStats();
}

function renderShell() {
  $('shopName').textContent = vendor.business_name;
  document.title = `${vendor.business_name} | PriceLink`;
  $('linkText').textContent = CONFIG.PUBLIC_BASE_URL.replace(/^https?:\/\//, '') + '/' + vendor.slug;
  $('viewPage').href = pageUrl(vendor.slug);
}

function renderPlan() {
  const pro = vendor.plan === 'pro';
  const box = $('plan');
  const kids = [
    el('div', { class: 'pt', text: pro ? 'Pro plan' : 'Free plan' }),
    el('div', { class: 'ps', text: pro ? `${products.length} products` : `${products.length} of ${FREE_LIMIT} products used` })
  ];
  if (!pro) {
    kids.push(el('a', {
      class: 'btn wide', target: '_blank', rel: 'noopener', text: 'Upgrade to Pro',
      style: 'height:44px;font-size:14px',
      href: `https://wa.me/${CONFIG.UPGRADE_WHATSAPP}?text=${encodeURIComponent('Hi, I want to upgrade ' + vendor.business_name + ' (' + vendor.slug + ') to Pro')}`
    }));
  }
  box.replaceChildren(...kids);
}

async function loadStats() {
  const { data, error } = await sb.rpc('vendor_stats');
  if (error || !data) return;
  $('sViews').textContent = data.views_today;
  $('sTaps').textContent = data.taps_today;
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').eq('vendor_id', me.id)
    .order('sort_order').order('created_at', { ascending: false });
  if (error) return toast(error.message, true);
  products = data;
  renderProducts();
}

function renderProducts() {
  const list = $('list');
  if (!products.length) {
    const add = el('button', { class: 'btn', type: 'button', text: 'Add your first product' });
    add.addEventListener('click', () => openProduct(null));
    list.replaceChildren(el('div', { class: 'empty' }, el('h3', { text: 'No products yet' }),
      el('p', { text: 'Add your first product and it appears on your page right away.' }), add));
  } else {
    list.replaceChildren(...products.map(row));
  }
  $('sProducts').textContent = products.length;
  $('cats').replaceChildren(...[...new Set(products.map((p) => p.category).filter(Boolean))]
    .map((c) => el('option', { value: c })));
  renderPlan();
}

function row(p) {
  const img = safeUrl(p.image_url);
  const thumb = el('div', { class: 'thumb' }, img ? el('img', { src: img, alt: '', loading: 'lazy' }) : bagIcon());
  const info = el('div', {},
    el('div', { class: 'pname', text: p.name }),
    el('div', { class: 'pmeta', text: [naira(p.price), p.category].filter(Boolean).join(' · ') }));
  const stock = el('button', {
    class: p.in_stock ? 'pill on' : 'pill', type: 'button',
    'aria-pressed': String(p.in_stock), 'aria-label': `${p.name}: toggle stock`,
    text: p.in_stock ? 'In stock' : 'Out of stock'
  });
  stock.addEventListener('click', () => toggleStock(p));
  const edit = el('button', { class: 'btn ghost', type: 'button', text: 'Edit', 'aria-label': `Edit ${p.name}` });
  edit.addEventListener('click', () => openProduct(p));
  const del = el('button', { class: 'btn danger', type: 'button', text: 'Delete', 'aria-label': `Delete ${p.name}` });
  del.addEventListener('click', () => deleteProduct(p));
  return el('div', { class: 'row' }, thumb, info, el('div', { class: 'acts' }, stock, edit, del));
}

async function toggleStock(p) {
  const next = !p.in_stock;
  const { error } = await sb.from('products').update({ in_stock: next }).eq('id', p.id).eq('vendor_id', me.id);
  if (error) return toast(error.message, true);
  p.in_stock = next;
  renderProducts();
}

// ----- Images -----

async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return blob || file;
  } catch (e) {
    return file;
  }
}

function removeStoredImage(url) {
  const marker = '/product-images/';
  const i = url ? url.indexOf(marker) : -1;
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length));
  if (path.startsWith(me.id + '/')) sb.storage.from('product-images').remove([path]).catch(() => {});
}

function showPreview(src) {
  const p = $('pPrev');
  p.hidden = !src;
  if (src) p.src = src;
}

// ----- Add / edit product -----

function openProduct(p) {
  if (!p && vendor.plan === 'free' && products.length >= FREE_LIMIT) {
    return toast('Free plan limit reached (10 products). Upgrade to Pro for unlimited products.', true);
  }
  editing = p;
  removeImg = false;
  $('pTitle').textContent = p ? 'Edit product' : 'Add product';
  $('pName').value = p ? p.name : '';
  $('pPrice').value = p ? p.price : '';
  $('pCat').value = p && p.category ? p.category : '';
  $('pStock').checked = p ? p.in_stock : true;
  $('pImg').value = '';
  showPreview(p ? safeUrl(p.image_url) : null);
  $('pRemove').hidden = !(p && p.image_url);
  $('pm').showModal();
  $('pName').focus();
}

$('pImg').addEventListener('change', () => {
  const f = $('pImg').files[0];
  if (!f) return;
  if (!f.type.startsWith('image/') || f.size > 10 * 1024 * 1024) {
    $('pImg').value = '';
    return toast('Choose an image under 10 MB.', true);
  }
  removeImg = false;
  showPreview(URL.createObjectURL(f));
});

$('pRemove').addEventListener('click', () => {
  removeImg = true;
  $('pImg').value = '';
  showPreview(null);
  $('pRemove').hidden = true;
});

$('pCancel').addEventListener('click', () => $('pm').close());

$('pf').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('pName').value.trim();
  const price = Number($('pPrice').value);
  if (!name) return toast('Enter the product name.', true);
  if ($('pPrice').value === '' || !isFinite(price) || price < 0) return toast('Enter a valid price.', true);

  $('pSave').disabled = true;
  try {
    let image_url = editing ? editing.image_url : null;
    const oldUrl = image_url;
    if (removeImg) image_url = null;

    const file = $('pImg').files[0];
    if (file) {
      const blob = await compress(file);
      const ext = blob.type === 'image/jpeg' ? 'jpg' : (blob.type.split('/')[1] || 'jpg');
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from('product-images').upload(path, blob, {
        contentType: blob.type || 'image/jpeg', cacheControl: '31536000'
      });
      if (up.error) throw up.error;
      image_url = sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name, price, image_url,
      category: $('pCat').value.trim() || null,
      in_stock: $('pStock').checked
    };
    const res = editing
      ? await sb.from('products').update(payload).eq('id', editing.id).eq('vendor_id', me.id)
      : await sb.from('products').insert({ ...payload, vendor_id: me.id });
    if (res.error) throw res.error;

    if (oldUrl && oldUrl !== image_url) removeStoredImage(oldUrl);
    $('pm').close();
    toast(editing ? 'Product updated' : 'Product added');
    await loadProducts();
  } catch (err) {
    toast(err.message || 'Could not save. Try again.', true);
  } finally {
    $('pSave').disabled = false;
  }
});

async function deleteProduct(p) {
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  const { error } = await sb.from('products').delete().eq('id', p.id).eq('vendor_id', me.id);
  if (error) return toast(error.message, true);
  removeStoredImage(p.image_url);
  toast('Product deleted');
  await loadProducts();
}

// ----- Shop settings -----

$('settingsBtn').addEventListener('click', () => {
  $('shName').value = vendor.business_name;
  $('shTag').value = vendor.tagline || '';
  $('shCity').value = vendor.city || '';
  $('shPhone').value = vendor.whatsapp_number;
  $('sd').showModal();
});
$('shCancel').addEventListener('click', () => $('sd').close());

$('sf').addEventListener('submit', async (e) => {
  e.preventDefault();
  const business_name = $('shName').value.trim();
  const whatsapp_number = normalizePhone($('shPhone').value);
  if (!business_name) return toast('Enter your shop name.', true);
  if (!whatsapp_number) return toast('Enter a valid WhatsApp number.', true);
  $('shSave').disabled = true;
  const { data, error } = await sb.from('vendors').update({
    business_name, whatsapp_number,
    tagline: $('shTag').value.trim() || null,
    city: $('shCity').value.trim() || null
  }).eq('id', me.id).select().single();
  $('shSave').disabled = false;
  if (error) return toast(error.message, true);
  vendor = data;
  renderShell();
  $('sd').close();
  toast('Settings saved');
});

// ----- Buttons -----

$('addBtn').addEventListener('click', () => openProduct(null));
$('logout').addEventListener('click', doLogout);
$('copyBtn').addEventListener('click', async () => {
  const link = `${CONFIG.PUBLIC_BASE_URL}/${vendor.slug}`;
  try {
    await navigator.clipboard.writeText(link);
    toast('Link copied');
  } catch (e) {
    toast(link);
  }
});

boot();