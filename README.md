# ChatRooms – Real-Time Chat with Rooms

A real-time chat app: people enter a display name, join a room by name, and
messages (with timestamps) go out live to everyone in that room. It runs on a
laptop and can be shared over the internet with a Cloudflare Tunnel.

Built with **Node.js**, **Express** and **Socket.IO**, with a plain HTML/CSS/JS frontend.

![Login page](docs/screenshots/login-desktop.png)

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
