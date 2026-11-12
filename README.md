# ChatRooms – Real-Time Chat with Rooms

A real-time chat app: people enter a display name, join a room by name, and
messages (with timestamps) go out live to everyone in that room. It runs on a
laptop. Public Cloudflare Tunnel startup is planned for a later implementation step.

Built with **Node.js**, **Express** and **Socket.IO**, with a plain HTML/CSS/JS frontend.

## Screenshots

| Login                                             | Chat room                                                  |
| ------------------------------------------------- | ---------------------------------------------------------- |
| ![Login page](docs/screenshots/login-desktop.png) | ![Chat room on desktop](docs/screenshots/chat-desktop.png) |

![Chat room on mobile](docs/screenshots/chat-mobile.png)

## Features

- Join a room with a display name; no account required
- Live room messages with server-generated timestamps shown in local time
- Online member list, join/leave notices, and automatic socket reconnection
- Room-scoped typing indicators that clear automatically after three seconds
- Unread message count in the browser tab title, reset when the chat is focused
- The latest 50 messages are available to people joining the room
- Responsive chat layout with mobile member-list toggle
- Safe text rendering: user messages are inserted as text, not HTML
- Enter to send, Shift+Enter for a newline, Unicode-aware 1000-character limit

## Message history

Each room keeps its latest 50 messages in memory while the server is running.
New members see those messages in chronological order. When the last member
leaves, the room and its history remain available for 10 minutes; joining again
within that period cancels the expiry. The countdown starts again when the room
next becomes empty. All history is lost when the server restarts, and anyone who
knows the room name can join and see its recent messages. Display names are not
authenticated. Message IDs are stored in the current tab for identifying your
own messages after a refresh; leaving or starting a new login clears them.

## Presence

The chat shows a typing indicator to other people in the same room while a
message is being composed. It clears when the person sends, leaves, disconnects,
or stops typing for three seconds. The browser sends one start notification per
typing burst and clears it after idle; the server also expires stale indicators.

When this tab is in the background, incoming messages from other people update
its title with an unread count, such as `(2) #general – ChatRooms`. Returning
focus to the chat clears the count. Notifications are local to the open tab and
are not persisted.

## Security and usage limits

The server applies Helmet security headers, including a Content Security Policy
that permits scripts and styles only from this app. Socket.IO accepts requests
from the same host only (or clients that omit an Origin header, such as the test
client). Each connection is limited to five messages per three seconds and ten
room joins per minute; each client IP may hold up to 20 simultaneous connections.
Socket.IO packets larger than 10 KB are rejected. The server does not log message
content.

The server binds to `127.0.0.1` by default so it is reachable only from this
laptop unless exposed through the planned tunnel. When behind Cloudflare Tunnel,
the app uses a valid `CF-Connecting-IP` address for connection limits and falls
back to the socket's remote address. Room names and display names are not
authentication; do not use this app for sensitive conversations.

## Prerequisites

| Tool        | Version | Install (Windows)                               |
| ----------- | ------- | ----------------------------------------------- |
| Node.js     | ≥ 20    | `winget install -e --id OpenJS.NodeJS.LTS`      |
| Git         | any     | `winget install -e --id Git.Git`                |
| cloudflared | any     | `winget install -e --id Cloudflare.cloudflared` |

> On Windows PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd` instead.

## Getting started

```powershell
git clone https://github.com/logeshps02/chat_room_project_Assessment.git
cd chat_room_project_Assessment
npm ci
npm start           # http://127.0.0.1:3000
```

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm start`        | Start the server                      |
| `npm run dev`      | Start with auto-restart on changes    |
| `npm test`         | Unit + integration tests (Jest)       |
| `npm run test:e2e` | Browser end-to-end tests (Playwright) |
| `npm run lint`     | ESLint                                |
| `npm run format`   | Prettier                              |

## Project structure

```
public/   static frontend (login + chat pages)
src/      server code (Express app, Socket.IO handlers, store, validation)
tests/    unit, integration and e2e tests
scripts/  helper scripts (public hosting)
```
