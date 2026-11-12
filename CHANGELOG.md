# Changelog

## 1.0.0 - 2026-11-12

- Added display-name login, case-insensitive rooms, live messages, and local-time
  display of server timestamps.
- Added online members, join/leave notices, typing indicators, unread tab
  counts, and the latest 50 messages in temporary room history.
- Added browser security headers, input and payload limits, per-connection rate
  limits, and a per-IP connection cap.
- Added Windows commands to start and stop a Cloudflare Quick Tunnel, with
  managed-process checks and public-hosting instructions.
- Added unit, integration, and multi-user browser tests.

### Known limitations

- Rooms are not authenticated and message history is not durable.
- A Quick Tunnel URL changes on restart and requires the laptop to stay online.
- GitHub Actions setup and a phone/mobile-data acceptance check remain pending.
