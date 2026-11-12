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
npm start           # http://localhost:3000
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
