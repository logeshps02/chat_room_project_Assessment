(function () {
  'use strict';

  const SESSION_KEY = 'chatrooms.session';
  const OWN_MESSAGE_IDS_KEY = 'chatrooms.ownMessageIds';
  const LAST_NAME_KEY = 'chatrooms.lastName';
  const LAST_ROOM_KEY = 'chatrooms.lastRoom';

  const { validateName, validateRoom } = window.ChatValidation;
  const form = document.getElementById('login-form');
  const nameInput = document.getElementById('name');
  const roomInput = document.getElementById('room');
  const nameError = document.getElementById('name-error');
  const roomError = document.getElementById('room-error');
  const loginError = document.getElementById('login-error');

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch {
      // Storage may be unavailable (private mode); the app still works for this tab.
    }
  }

  function setError(input, el, message) {
    el.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  const roomFromUrl = new URLSearchParams(window.location.search).get('room');
  nameInput.value = safeGet(localStorage, LAST_NAME_KEY) || '';
  roomInput.value = roomFromUrl || safeGet(localStorage, LAST_ROOM_KEY) || 'General';
  (nameInput.value ? roomInput : nameInput).focus();

  document.querySelectorAll('[data-room]').forEach((chip) => {
    chip.addEventListener('click', () => {
      roomInput.value = chip.dataset.room;
      setError(roomInput, roomError, '');
      roomInput.focus();
    });
  });

  nameInput.addEventListener('input', () => setError(nameInput, nameError, ''));
  roomInput.addEventListener('input', () => setError(roomInput, roomError, ''));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loginError.textContent = '';
    const name = validateName(nameInput.value);
    const room = validateRoom(roomInput.value);

    setError(nameInput, nameError, name.ok ? '' : name.error);
    setError(roomInput, roomError, room.ok ? '' : room.error);

    if (!name.ok) return nameInput.focus();
    if (!room.ok) return roomInput.focus();

    try {
      sessionStorage.removeItem(OWN_MESSAGE_IDS_KEY);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name.value, room: room.value }));
    } catch (error) {
      console.warn('Unable to start the chat session:', error);
      loginError.textContent = 'Browser session storage is unavailable. Please enable it to join.';
      return;
    }
    safeSet(localStorage, LAST_NAME_KEY, name.value);
    safeSet(localStorage, LAST_ROOM_KEY, room.value);
    window.location.assign('/chat.html');
  });
})();
