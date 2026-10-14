const panels = [...document.querySelectorAll('.story-panel')];
const dots = [...document.querySelectorAll('.dot')];
const previous = document.getElementById('previous');
const next = document.getElementById('next');
let current = 0;

function showPanel(index) {
  if (index < 0 || index >= panels.length || index === current) return;
  panels[current].classList.remove('active');
  panels[current].hidden = true;
  current = index;
  panels[current].hidden = false;
  panels[current].classList.add('active');
  panels[current].scrollTop = 0;
  dots.forEach((dot, i) => i === current ? dot.setAttribute('aria-current','step') : dot.removeAttribute('aria-current'));
  previous.disabled = current === 0;
  next.disabled = current === panels.length - 1;
}

previous.addEventListener('click', () => showPanel(current - 1));
next.addEventListener('click', () => showPanel(current + 1));
dots.forEach((dot, i) => dot.addEventListener('click', () => showPanel(i)));

document.addEventListener('keydown', (event) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (event.key === 'ArrowRight') showPanel(current + 1);
  if (event.key === 'ArrowLeft') showPanel(current - 1);
});

let touchX = null;
const frame = document.querySelector('.story-frame');
frame.addEventListener('touchstart', e => touchX = e.changedTouches[0].screenX, { passive:true });
frame.addEventListener('touchend', e => {
  if (touchX === null || e.target.closest('button,input,textarea')) return;
  const delta = e.changedTouches[0].screenX - touchX;
  if (Math.abs(delta) > 60) showPanel(current + (delta < 0 ? 1 : -1));
  touchX = null;
}, { passive:true });

document.getElementById('blessing-button').addEventListener('click', (event) => {
  document.getElementById('blessing-status').textContent = 'A little blessing for you.';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = event.currentTarget.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.className = 'particle';
    star.textContent = i % 2 ? '○' : '✦';
    star.style.left = box.left + box.width / 2 + (i - 2) * 12 + 'px';
    star.style.top = box.top + 'px';
    star.style.setProperty('--dx', (i - 2) * 21 + 'px');
    document.body.appendChild(star);
    star.addEventListener('animationend', () => star.remove(), { once:true });
  }
});

const form = document.getElementById('rsvp-form');
const message = document.getElementById('form-message');
const confirmation = document.getElementById('confirmation');
const yes = document.getElementById('attend-yes');
const no = document.getElementById('attend-no');
const submitButton = document.getElementById('submit-rsvp');
const submitDefault = submitButton.querySelector('.submit-default');
const submitLoading = submitButton.querySelector('.submit-loading');
const searchInput = document.getElementById('guest-search');
const searchResults = document.getElementById('guest-results');
const searchStatus = document.getElementById('guest-search-status');
const selectedGuestBox = document.getElementById('selected-guest');
const selectedGuestName = document.getElementById('selected-guest-name');
const changeGuestButton = document.getElementById('change-guest');
const responseFields = document.getElementById('response-fields');
let attending = '';
let selectedGuest = null;
let searchTimer = null;
let jsonpCounter = 0;

function choose(value) {
  attending = value;
  yes.setAttribute('aria-pressed', String(value === 'Joyfully attending'));
  no.setAttribute('aria-pressed', String(value === 'Unable to attend'));
  message.classList.add('hidden');
}

function showMessage(text) {
  message.textContent = text;
  message.classList.remove('hidden');
}

function setSending(isSending) {
  submitButton.disabled = isSending;
  submitDefault.classList.toggle('hidden', isSending);
  submitLoading.classList.toggle('hidden', !isSending);
}

function getGoogleScriptUrl() {
  return window.RSVP_CONFIG?.GOOGLE_SCRIPT_URL?.trim() || '';
}

function endpointReady() {
  const endpoint = getGoogleScriptUrl();
  return endpoint && !endpoint.includes('PASTE_YOUR_');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[char]));
}

function searchGuests(query) {
  return new Promise((resolve, reject) => {
    if (!endpointReady()) {
      reject(new Error('RSVP endpoint is not configured.'));
      return;
    }

    const callbackName = `__guestSearchCallback${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement('script');
    const timeout = setTimeout(() => cleanup(new Error('Guest search timed out.')), 12000);

    function cleanup(error, data) {
      clearTimeout(timeout);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      if (error) reject(error); else resolve(data);
    }

    window[callbackName] = payload => cleanup(null, payload);
    script.onerror = () => cleanup(new Error('Could not load guest list.'));
    script.src = `${getGoogleScriptUrl()}?action=search&q=${encodeURIComponent(query)}&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

function clearGuestSelection() {
  selectedGuest = null;
  selectedGuestBox.classList.add('hidden');
  responseFields.classList.add('hidden');
  searchInput.closest('.guest-search-wrap').classList.remove('hidden');
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchStatus.textContent = 'Type at least 2 letters of your name.';
  choose('');
  form.reset();
  searchInput.focus();
}

function selectGuest(guest) {
  selectedGuest = guest;
  selectedGuestName.textContent = guest.name;
  selectedGuestBox.classList.remove('hidden');
  responseFields.classList.remove('hidden');
  searchInput.closest('.guest-search-wrap').classList.add('hidden');
  searchResults.innerHTML = '';
  searchStatus.textContent = '';
  choose('');
  document.getElementById('dietary-notes').value = '';
  if (guest.attendance) {
    message.textContent = `We already have a response for ${guest.name}: ${guest.attendance}. You can submit again to update it.`;
    message.classList.remove('hidden');
  }
}

function renderGuestResults(guests) {
  searchResults.innerHTML = '';
  if (!guests.length) {
    searchStatus.textContent = 'No matching invited name found. Please check the spelling.';
    return;
  }

  searchStatus.textContent = `${guests.length} matching ${guests.length === 1 ? 'name' : 'names'} found. Select yours:`;
  guests.forEach(guest => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'guest-result';
    button.innerHTML = `<span>${escapeHtml(guest.name)}</span>${guest.attendance ? `<small>Response on file</small>` : '<small>Awaiting RSVP</small>'}`;
    button.addEventListener('click', () => selectGuest(guest));
    searchResults.appendChild(button);
  });
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  searchResults.innerHTML = '';

  if (query.length < 2) {
    searchStatus.textContent = 'Type at least 2 letters of your name.';
    return;
  }

  searchStatus.textContent = 'Searching guest list…';
  searchTimer = setTimeout(async () => {
    try {
      const payload = await searchGuests(query);
      if (!payload?.ok) throw new Error(payload?.error || 'Search failed.');
      if (searchInput.value.trim() !== query) return;
      renderGuestResults(payload.guests || []);
    } catch (error) {
      console.error(error);
      searchStatus.textContent = endpointReady()
        ? 'Could not search the guest list. Please try again.'
        : 'RSVP search is not connected yet. Add your Apps Script URL in config.js.';
    }
  }, 300);
});

changeGuestButton.addEventListener('click', clearGuestSelection);
yes.addEventListener('click', () => choose('Joyfully attending'));
no.addEventListener('click', () => choose('Unable to attend'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedGuest) {
    showMessage('Please search for and select your name first.');
    searchInput.focus();
    return;
  }

  if (!attending) {
    showMessage('Please choose an RSVP response.');
    yes.focus();
    return;
  }

  if (!endpointReady()) {
    showMessage('RSVP is not connected yet. Please add the Google Apps Script URL in config.js.');
    return;
  }

  const payload = new URLSearchParams({
    guest_id: selectedGuest.id,
    guest_name: selectedGuest.name,
    attending,
    dietary_notes: document.getElementById('dietary-notes').value.trim()
  });

  setSending(true);
  message.classList.add('hidden');

  try {
    await fetch(getGoogleScriptUrl(), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: payload.toString()
    });

    document.getElementById('confirmation-name').textContent = selectedGuest.name;
    form.classList.add('hidden');
    confirmation.classList.remove('hidden');
    confirmation.focus();
  } catch (error) {
    console.error('RSVP submission failed:', error);
    showMessage('We could not send your RSVP. Please check your connection and try again.');
  } finally {
    setSending(false);
  }
});

document.getElementById('another-rsvp').addEventListener('click', () => {
  confirmation.classList.add('hidden');
  form.classList.remove('hidden');
  clearGuestSelection();
});
