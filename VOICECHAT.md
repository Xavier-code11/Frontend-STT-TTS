# Voice Chat Client Module

This project includes a Voice Chat client with two connection modes:

- Mode A (HTTP streaming): quick go-live via multipart POST.
- Mode B (WebSocket realtime): low-latency streaming.

## Environment variables

Define the following in `clientside/.env`:

```
REACT_APP_BACKEND_HTTP_URL=http://localhost:8000
REACT_APP_BACKEND_WS_URL=ws://localhost:8000
REACT_APP_SESSION_ID=web-client
REACT_APP_LANGUAGE=id
REACT_APP_AUDIO_MIME=audio/wav
```

Notes:
- URLs are automatically normalized to include `/api/v1` prefix.
- If the page is served over HTTPS, the WebSocket URL will auto-upgrade to `wss://`.

## Backend contract

WebSocket endpoint `/api/v1/rt/chat` (protocol: `start → binary → stop`):
- Send: `{"type":"start","session_id":"<...>","language":"<...>"}`
- Stream binary audio chunks from `MediaRecorder` while `ws.readyState===1`.
- Send: `{"type":"stop"}` when done.
- Receive: `{"event":"audio_start","media_type":"audio/mpeg"}` followed by binary frames, then `{"event":"audio_end"}`. Errors like `{"event":"error","detail":"empty_audio"}` are handled.

HTTP endpoints:
- Streaming: `POST /api/v1/tts/stt-chat-tts-stream`
- Non-stream: `POST /api/v1/tts/stt-chat-tts`
Send multipart form-data with fields: `audio` (Blob), `session_id`, `language`. Do not manually set `Content-Type`; set `Accept: application/json`.

## Files

- `src/config/env.js` – centralized env reader and URL normalization.
- `src/lib/audio/MediaRecorderManager.js` – microphone capture and chunking.
- `src/lib/audio/AudioStreamPlayer.js` – streaming playback (MediaSource for mpeg).
- `src/services/transports/WebSocketChatTransport.js` – WS protocol and streaming handling.
- `src/services/transports/HttpChatTransport.js` – multipart POST and streaming/response handling.
- `src/services/VoiceChatClient.js` – facade coordinating recorder and transports.
- `src/components/VoiceChatWidget.jsx` – simple UI to test both modes.

## Try it

1. Set up `clientside/.env` as above.
2. Start the dev server.
3. Switch between modes in the widget, click Start to record, Stop to send, and listen to the streamed reply.

The client logs: chunk sizes, blob.type, `ws.readyState`, and timestamps for start/stop. Only one WebSocket instance is created per session.
