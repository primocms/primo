const form = document.querySelector('#setup');
const intro = document.querySelector('#intro');
const message = document.querySelector('#message');
const open = document.querySelector('#open');
const heading = document.querySelector('h1');
let token = location.hash.slice(1);
history.replaceState(null, '', '/setup');
async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
function showStatus(status) {
  form.hidden = true;
  if (status.state === 'ready') {
    heading.textContent = 'Your server is ready.';
    intro.textContent = 'Your server is ready. Sign in with your purchase email and the password you chose.';
    message.textContent = '';
    open.href = status.url;
    open.hidden = false;
  } else if (status.state === 'suspended') {
    heading.textContent = 'Your subscription has ended.';
    intro.textContent = 'Your server is paused and your data is saved.';
    message.textContent = 'Contact Primo to restore access.';
    open.hidden = true;
  } else if (status.state === 'attention') {
    heading.textContent = 'We’re on it.';
    intro.textContent = 'Your setup needs a little help.';
    message.textContent = 'Your details are saved. Contact Primo and we’ll finish setting up your server.';
  } else {
    heading.textContent = 'Setting up your server.';
    intro.textContent = 'We’re setting up your server.';
    message.textContent = 'This usually takes a few minutes. You can leave this page open, or check your email for the dashboard link.';
    setTimeout(poll, 5000);
  }
}
async function poll() {
  try { showStatus(await api('/api/setup/status')); }
  catch { message.textContent = 'Unable to check progress. Your setup is saved; refresh to try again.'; }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  message.textContent = '';
  try {
    const status = await api('/api/setup/claim', { token, slug: form.slug.value, password: form.password.value });
    token = '';
    form.password.value = '';
    showStatus(status);
  } catch (error) { message.textContent = error.message; button.disabled = false; }
});
(async () => {
  try { showStatus(await api('/api/setup/status')); return; } catch {}
  if (!token) { intro.textContent = 'Open the private setup link in your Primo purchase email.'; return; }
  try {
    const info = await api('/api/setup/info', { token });
    intro.textContent = `${info.plan} plan · ${info.email}`;
    document.querySelector('#suffix').textContent = `.${info.domain}`;
    form.hidden = false;
  } catch { intro.textContent = 'This setup link has expired or has already been used. Contact Primo for help.'; }
})();
