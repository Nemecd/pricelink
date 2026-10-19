const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
let slugTouched = false;
let slugTimer;
let slugRun = 0;

function show(text, isError) {
  const m = $('msg');
  m.textContent = text;
  m.className = 'msg ' + (isError ? 'err' : 'ok');
}

function setTab(signup) {
  $('formLogin').hidden = signup;
  $('formSignup').hidden = !signup;
  $('tabLogin').setAttribute('aria-selected', String(!signup));
  $('tabSignup').setAttribute('aria-selected', String(signup));
  show('', false);
}

function hint(text, isError) {
  const h = $('slugHint');
  h.textContent = text;
  h.className = 'hint' + (isError ? ' err' : '');
}

// Returns true (free), false (taken or invalid) or null (could not check)
async function checkSlug() {
  const s = $('sSlug').value.trim().toLowerCase();
  const run = ++slugRun;
  if (!SLUG_RE.test(s)) {
    hint('Use 3 to 30 letters, numbers, - or _', true);
    return false;
  }
  hint('Checking…');
  const { data, error } = await sb.rpc('slug_available', { p_slug: s });
  if (run !== slugRun) return null; // a newer check replaced this one
  if (error) {
    hint('Could not check right now. Try again.', true);
    return null;
  }
  hint(data ? 'Available ✓' : 'Already taken or not allowed', !data);
  return !!data;
}

$('tabLogin').addEventListener('click', () => setTab(false));
$('tabSignup').addEventListener('click', () => setTab(true));

// Suggest a link from the shop name until the vendor edits it themselves
$('sName').addEventListener('input', () => {
  if (slugTouched) return;
  $('sSlug').value = $('sName').value.toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 30);
  clearTimeout(slugTimer);
  slugTimer = setTimeout(checkSlug, 400);
});
$('sSlug').addEventListener('input', () => {
  slugTouched = true;
  $('sSlug').value = $('sSlug').value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  clearTimeout(slugTimer);
  slugTimer = setTimeout(checkSlug, 400);
});

$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('lEmail').value.trim();
  const password = $('lPass').value;
  if (!email || !password) return show('Enter your email and password.', true);
  $('lBtn').disabled = true;
  show('Logging in…', false);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $('lBtn').disabled = false;
    return show(error.message === 'Invalid login credentials'
      ? 'Wrong email or password.' : error.message, true);
  }
  location.replace('dashboard.html');
});

$('formSignup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const business_name = $('sName').value.trim();
  const slug = $('sSlug').value.trim().toLowerCase();
  const whatsapp_number = normalizePhone($('sPhone').value);
  const email = $('sEmail').value.trim();
  const password = $('sPass').value;

  if (!business_name) return show('Enter your shop name.', true);
  if (!whatsapp_number) return show('Enter a valid WhatsApp number, like 0801 234 5678.', true);
  if (!email) return show('Enter your email.', true);
  if (password.length < 8) return show('Password must be at least 8 characters.', true);

  $('sBtn').disabled = true;
  show('Checking your link…', false);
  const free = await checkSlug();
  if (free !== true) {
    $('sBtn').disabled = false;
    return show(free === false ? 'Please choose a different link.' : 'Could not check your link. Try again.', true);
  }

  show('Creating your account…', false);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { business_name, slug, whatsapp_number } }
  });
  $('sBtn').disabled = false;
  if (error) return show(error.message, true);
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return show('That email already has an account. Try logging in.', true);
  }
  if (data.session) return location.replace('dashboard.html');
  show('Account created. Check your email to confirm, then log in.', false);
  setTab(false);
  show('Account created. Check your email to confirm, then log in.', false);
});

// Already logged in? Go straight to the dashboard.
sb.auth.getSession().then(({ data }) => {
  if (data.session) location.replace('dashboard.html');
});