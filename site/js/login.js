RB.mount('');
(async () => { try { if (await RB.me()) location.replace('home.html'); } catch (e) { document.getElementById('Message').textContent = e.message; } })();
let mode = 'login';
const form = document.getElementById('AuthForm');
for (const tab of document.querySelectorAll('[data-mode]')) tab.addEventListener('click', () => {
  mode = tab.dataset.mode;
  for (const el of document.querySelectorAll('[data-mode]')) el.setAttribute('aria-selected', String(el === tab));
  document.getElementById('ConfirmRow').hidden = mode !== 'register';
  form.elements.confirm.required = mode === 'register';
  form.elements.password.minLength = mode === 'register' ? 6 : 1;
  form.elements.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  document.getElementById('Submit').textContent = mode === 'register' ? 'Create Account' : 'Login';
  document.getElementById('FormTitle').textContent = mode === 'register' ? 'Join 2x2' : 'Log in to 2x2';
  document.getElementById('Message').textContent = '';
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.getElementById('Message'), button = document.getElementById('Submit');
  message.textContent = '';
  if (mode === 'register' && form.elements.password.value !== form.elements.confirm.value) { message.textContent = 'Passwords do not match.'; return; }
  button.disabled = true;
  try {
    await RB.api(mode, { method: 'POST', body: { username: form.elements.username.value.trim(), password: form.elements.password.value } });
    location.replace('home.html');
  } catch (error) { message.textContent = error.message; button.disabled = false; }
});
