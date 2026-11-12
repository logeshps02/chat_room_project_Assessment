(function () {
  'use strict';

  const SESSION_KEY = 'chatrooms.session';
  const OWN_MESSAGE_IDS_KEY = 'chatrooms.ownMessageIds';
  const MAX_OWN_MESSAGE_IDS = 50;
  const { MESSAGE_MAX, charLength } = window.ChatValidation;

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (
        session &&
        typeof session.name === 'string' &&
        typeof session.room === 'string' &&
        session.name.trim() &&
        session.room.trim()
      ) {
        return { name: session.name, room: session.room };
      }
    } catch {
      // Missing or malformed session data returns the user to the login form.
    }
    window.location.replace('/');
    return null;
  }

  const session = readSession();
  if (!session) return;

  const roomName = document.getElementById('room-name');
  const connectionState = document.getElementById('connection-state');
  const connectionLabel = document.getElementById('connection-label');
  const messages = document.getElementById('messages');
  const emptyState = document.getElementById('empty-state');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const charCount = document.getElementById('char-count');
  const messageError = document.getElementById('message-error');
  const chatNotice = document.getElementById('chat-notice');
  const newMessagesButton = document.getElementById('new-messages');
  const usersList = document.getElementById('users-list');
  const userCount = document.getElementById('user-count');
  const panelUserCount = document.getElementById('panel-user-count');
  const usersPanel = document.getElementById('users-panel');
  const usersToggle = document.getElementById('users-toggle');
  let joined = false;
  let currentDay = '';
  let displayName = session.name;
  const ownMessageIds = readOwnMessageIds();

  document.title = `#${session.room} · ChatRooms`;
  roomName.textContent = session.room;

  function setConnection(state, label) {
    connectionState.dataset.state = state;
    connectionLabel.textContent = label;
    updateComposer();
  }

  function setNotice(message) {
    chatNotice.textContent = message;
    chatNotice.hidden = !message;
  }

  function readOwnMessageIds() {
    try {
      const saved = sessionStorage.getItem(OWN_MESSAGE_IDS_KEY);
      if (!saved) return new Set();
      const ids = JSON.parse(saved);
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
        throw new TypeError('Invalid stored message identifiers');
      }
      return new Set(ids.slice(-MAX_OWN_MESSAGE_IDS));
    } catch (error) {
      console.warn('Unable to restore message ownership:', error);
      return new Set();
    }
  }

  function rememberOwnMessage(id) {
    if (typeof id !== 'string') {
      console.warn('A message arrived without a valid identifier.');
      return;
    }
    ownMessageIds.add(id);
    if (ownMessageIds.size > MAX_OWN_MESSAGE_IDS) {
      ownMessageIds.delete(ownMessageIds.values().next().value);
    }
    try {
      sessionStorage.setItem(OWN_MESSAGE_IDS_KEY, JSON.stringify([...ownMessageIds]));
    } catch (error) {
      console.warn('Unable to remember message ownership:', error);
      setNotice('Your messages may not be marked as yours after a refresh.');
    }
  }

  function messageLength(value) {
    return charLength(value);
  }

  function updateComposer() {
    const length = messageLength(messageInput.value);
    charCount.textContent = `${length} / ${MESSAGE_MAX}`;
    charCount.classList.toggle('is-over-limit', length > MESSAGE_MAX);
    sendButton.disabled =
      !joined || !socket.connected || !messageInput.value.trim() || length > MESSAGE_MAX;
    messageInput.disabled = !joined || !socket.connected;
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function dayLabel(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dayKey(date) === dayKey(today)) return 'Today';
    if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function appendDaySeparator(date) {
    const key = dayKey(date);
    if (key === currentDay) return;
    currentDay = key;
    const separator = document.createElement('div');
    separator.className = 'date-separator';
    const label = document.createElement('span');
    label.textContent = dayLabel(date);
    separator.append(label);
    messages.append(separator);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function appendMessage(message) {
    const date = new Date(message.ts);
    if (!Number.isFinite(date.getTime())) return;
    const wasAtBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 96;

    emptyState.hidden = true;
    appendDaySeparator(date);

    if (message.type === 'system') {
      const system = document.createElement('div');
      system.className = 'system-message';
      system.dataset.messageId = message.id;
      const text = document.createElement('span');
      text.textContent = message.text;
      system.append(text);
      messages.append(system);
    } else {
      const isMine = ownMessageIds.has(message.id);
      const row = document.createElement('article');
      row.className = `message-row${isMine ? ' is-mine' : ''}`;
      row.dataset.messageId = message.id;
      row.dataset.messageType = message.type;

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = Array.from(message.name || '?')[0].toLocaleUpperCase();

      const content = document.createElement('div');
      content.className = 'message-content';
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      const sender = document.createElement('span');
      sender.className = 'message-sender';
      sender.textContent = isMine ? 'You' : message.name;
      const time = document.createElement('time');
      time.className = 'message-time';
      time.dateTime = date.toISOString();
      time.textContent = formatTime(date);
      time.title = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
      meta.append(sender, time);

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = message.text;
      content.append(meta, bubble);
      row.append(avatar, content);
      messages.append(row);
    }

    if (wasAtBottom) {
      messages.scrollTop = messages.scrollHeight;
      newMessagesButton.hidden = true;
    } else {
      newMessagesButton.hidden = false;
    }
  }

  function renderHistory(history) {
    messages.replaceChildren();
    messages.append(emptyState);
    emptyState.hidden = true;
    currentDay = '';
    history.forEach(appendMessage);
    if (history.length === 0) emptyState.hidden = false;
    messages.scrollTop = messages.scrollHeight;
    newMessagesButton.hidden = true;
  }

  function renderUsers(users) {
    usersList.replaceChildren();
    users.forEach((name) => {
      const item = document.createElement('li');
      item.className = 'user-item';
      const avatar = document.createElement('span');
      avatar.className = 'user-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = Array.from(name)[0].toLocaleUpperCase();
      const label = document.createElement('span');
      label.className = 'user-name';
      label.textContent = name;
      const online = document.createElement('span');
      online.className = 'user-online';
      online.setAttribute('aria-label', 'online');
      item.append(avatar, label);
      if (name === displayName) {
        const you = document.createElement('span');
        you.className = 'you-badge';
        you.textContent = 'you';
        item.append(you);
      }
      item.append(online);
      usersList.append(item);
    });
    userCount.textContent = String(users.length);
    panelUserCount.textContent = String(users.length);
  }

  function joinRoom() {
    if (!socket.connected) return;
    joined = false;
    setConnection('connecting', 'Joining room');
    socket.timeout(5000).emit('room:join', session, (error, response) => {
      if (error) {
        setConnection('disconnected', 'Connection timed out');
        setNotice('Could not join the room. Check your connection and try again.');
        return;
      }
      if (!response || !response.ok) {
        setConnection('disconnected', 'Unable to join');
        setNotice(response && response.error ? response.error : 'Could not join this room.');
        return;
      }

      displayName = response.user.name;
      session.room = response.room;
      roomName.textContent = response.room;
      document.title = `#${response.room} · ChatRooms`;
      joined = true;
      setNotice('');
      setConnection('connected', 'Connected');
      renderUsers(response.users);
      renderHistory(response.history);
      messageInput.focus();
    });
  }

  const socket = window.io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', joinRoom);
  socket.on('disconnect', () => {
    joined = false;
    setConnection('disconnected', 'Reconnecting');
  });
  socket.on('connect_error', () => setConnection('disconnected', 'Connection issue'));
  socket.on('message:new', (message) => {
    if (message.name === displayName) rememberOwnMessage(message.id);
    appendMessage(message);
  });
  socket.on('system', appendMessage);
  socket.on('room:users', ({ users }) => {
    if (Array.isArray(users)) renderUsers(users);
  });

  socket.io.on('reconnect_attempt', () => setConnection('connecting', 'Reconnecting'));
  socket.io.on('reconnect', () => setConnection('connecting', 'Joining room'));

  messageInput.addEventListener('input', () => {
    messageError.textContent = '';
    updateComposer();
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 144)}px`;
  });

  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!sendButton.disabled) composer.requestSubmit();
    }
  });

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = messageInput.value;
    const length = messageLength(text);
    if (!joined || !socket.connected || !text.trim() || length > MESSAGE_MAX) {
      updateComposer();
      return;
    }
    sendButton.disabled = true;
    socket.timeout(5000).emit('message:send', { text }, (error, response) => {
      if (error) {
        messageError.textContent = 'Message was not sent. Check your connection and try again.';
      } else if (!response || !response.ok) {
        messageError.textContent =
          response && response.error ? response.error : 'Message could not be sent.';
      } else if (messageInput.value === text) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageError.textContent = '';
      }
      updateComposer();
      if (joined && socket.connected) messageInput.focus();
    });
  });

  messages.addEventListener('scroll', () => {
    if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 96) {
      newMessagesButton.hidden = true;
    }
  });

  newMessagesButton.addEventListener('click', () => {
    messages.scrollTop = messages.scrollHeight;
    newMessagesButton.hidden = true;
    messageInput.focus();
  });

  function setUsersPanelOpen(open) {
    usersPanel.classList.toggle('is-open', open);
    usersToggle.setAttribute('aria-expanded', String(open));
  }

  usersToggle.addEventListener('click', () => {
    setUsersPanelOpen(!usersPanel.classList.contains('is-open'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setUsersPanelOpen(false);
  });

  document.getElementById('leave-button').addEventListener('click', () => {
    joined = false;
    socket.disconnect();
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(OWN_MESSAGE_IDS_KEY);
    } catch (error) {
      console.warn('Unable to clear the chat session:', error);
    }
    window.location.assign('/');
  });

  updateComposer();
})();
