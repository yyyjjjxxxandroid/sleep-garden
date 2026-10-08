#!/usr/bin/env python3
"""Capture before/after UI states via Chrome DevTools Protocol (no extra deps)."""

from __future__ import annotations

import base64
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = Path(__file__).resolve().parents[1]
PORT_BASE = 9333

TARGETS = {
    "before": ("http://127.0.0.1:8766/index.html", ROOT / "before", PORT_BASE),
    "after": ("http://127.0.0.1:8765/index.html", ROOT / "after", PORT_BASE + 1),
}


class WebSocketClient:
    def __init__(self, url: str):
        assert url.startswith("ws://")
        rest = url[5:]
        hostport, _, path = rest.partition("/")
        host, _, port_s = hostport.partition(":")
        port = int(port_s or "80")
        path = "/" + path
        self.sock = socket.create_connection((host, port), timeout=20)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WS handshake failed")
            data += chunk
        if b"101" not in data.split(b"\r\n", 1)[0]:
            raise RuntimeError("WS upgrade rejected: " + data[:200].decode("utf-8", "ignore"))
        self._id = 0

    def send(self, method: str, params: dict | None = None, session_id: str | None = None):
        self._id += 1
        msg = {"id": self._id, "method": method}
        if params is not None:
            msg["params"] = params
        if session_id:
            msg["sessionId"] = session_id
        raw = json.dumps(msg).encode()
        # client frames must be masked
        mask = os.urandom(4)
        header = bytearray([0x81])
        n = len(raw)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header.extend(n.to_bytes(2, "big"))
        else:
            header.append(0x80 | 127)
            header.extend(n.to_bytes(8, "big"))
        header.extend(mask)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(raw))
        self.sock.sendall(header + masked)
        return self._wait(self._id)

    def _recv_frame(self) -> bytes:
        hdr = self._recv_exact(2)
        opcode = hdr[0] & 0x0F
        length = hdr[1] & 0x7F
        if length == 126:
            length = int.from_bytes(self._recv_exact(2), "big")
        elif length == 127:
            length = int.from_bytes(self._recv_exact(8), "big")
        masked = bool(hdr[1] & 0x80)
        mask = self._recv_exact(4) if masked else b""
        payload = self._recv_exact(length)
        if masked:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        if opcode == 0x8:
            raise RuntimeError("WS closed")
        if opcode == 0x9:  # ping
            # pong
            self.sock.sendall(bytes([0x8A, 0x80]) + os.urandom(4))
            return self._recv_frame()
        return payload

    def _recv_exact(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise RuntimeError("socket closed")
            buf += chunk
        return buf

    def _wait(self, expect_id: int, timeout: float = 30.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.sock.settimeout(max(0.1, deadline - time.time()))
            try:
                payload = self._recv_frame()
            except socket.timeout:
                continue
            if not payload:
                continue
            msg = json.loads(payload)
            if msg.get("id") == expect_id:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})
        raise TimeoutError(f"no response for id={expect_id}")

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def start_chrome(port: int, url: str) -> subprocess.Popen:
    user_data = ROOT / f".chrome-{port}"
    if user_data.exists():
        import shutil

        shutil.rmtree(user_data, ignore_errors=True)
    user_data.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={user_data}",
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        url,
    ]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_ws(port: int, timeout: float = 20.0) -> str:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1) as r:
                tabs = json.load(r)
            for t in tabs:
                if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                    return t["webSocketDebuggerUrl"]
            last = tabs
        except Exception as e:
            last = e
        time.sleep(0.2)
    raise RuntimeError(f"no page ws on {port}: {last}")


def screenshot(ws: WebSocketClient, path: Path, width=390, height=844):
    ws.send(
        "Emulation.setDeviceMetricsOverride",
        {
            "width": width,
            "height": height,
            "deviceScaleFactor": 2,
            "mobile": width < 700,
        },
    )
    time.sleep(0.3)
    result = ws.send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(result["data"]))
    print("wrote", path)


def evaluate(ws: WebSocketClient, expression: str, retries: int = 4):
    last = None
    for _ in range(retries):
        try:
            return ws.send(
                "Runtime.evaluate",
                {"expression": expression, "awaitPromise": True, "returnByValue": True},
            )
        except RuntimeError as e:
            last = e
            if "Execution context was destroyed" in str(e) or "Cannot find context" in str(e):
                time.sleep(0.8)
                continue
            raise
    raise last


def capture_target(label: str, url: str, out_dir: Path, port: int):
    proc = start_chrome(port, "about:blank")
    try:
        ws_url = wait_ws(port)
        ws = WebSocketClient(ws_url)
        ws.send("Page.enable")
        ws.send("Runtime.enable")
        ws.send("Page.navigate", {"url": url})
        time.sleep(1.2)
        # wait for app boot / possible reloads
        evaluate(
            ws,
            """
            (async () => {
              const start = Date.now();
              while (Date.now() - start < 15000) {
                if (document.querySelector('#startButton')) break;
                await new Promise(r => setTimeout(r, 250));
              }
              const app = document.querySelector('.app');
              if (app) {
                app.classList.add('world-ready');
                app.dataset.world = 'ready';
              }
              document.querySelectorAll('.asset-status,#bootLoader').forEach(el => {
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
              });
              await new Promise(r => setTimeout(r, 800));
              return !!document.querySelector('#startButton');
            })()
            """,
        )

        # 1) loading state
        evaluate(
            ws,
            """
            (() => {
              const app = document.querySelector('.app');
              const loader = document.querySelector('#bootLoader');
              if (app) { app.classList.remove('world-ready'); app.classList.add('audio-loading'); }
              if (loader) {
                loader.querySelector('p').textContent = '声音即将响起';
                loader.querySelector('span').textContent = '请稍候，正在准备本地音效';
              }
              return true;
            })()
            """,
        )
        time.sleep(0.4)
        screenshot(ws, out_dir / "loading.png", 390, 844)

        # restore ready + home
        evaluate(
            ws,
            """
            (() => {
              const app = document.querySelector('.app');
              if (app) { app.classList.add('world-ready'); app.classList.remove('audio-loading'); }
              return true;
            })()
            """,
        )
        time.sleep(0.3)
        screenshot(ws, out_dir / "home-mobile.png", 390, 844)
        screenshot(ws, out_dir / "home-desktop.png", 1100, 800)

        # enter session if possible
        evaluate(
            ws,
            """
            (async () => {
              const btn = document.querySelector('#startButton');
              if (btn) btn.click();
              await new Promise(r => setTimeout(r, 1500));
              const app = document.querySelector('.app');
              if (app) {
                app.classList.add('world-ready');
                app.classList.remove('audio-loading');
                app.dataset.world = 'ready';
                if (!app.dataset.audio) app.dataset.audio = 'running';
              }
              document.querySelectorAll('.asset-status,#bootLoader').forEach(el => {
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
              });
              if (window.state) {
                state.mode = 'session';
                state.playing = true;
                state.elapsed = 95;
                state.duration = state.timerSeconds || 0;
              }
              if (typeof updateSessionChrome === 'function') updateSessionChrome();
              if (typeof updateProgress === 'function') updateProgress();
              if (typeof showMode === 'function') showMode();
              return document.querySelector('#controls') && !document.querySelector('#controls').hidden;
            })()
            """,
        )
        time.sleep(0.5)
        screenshot(ws, out_dir / "session-running.png", 390, 844)

        # paused state
        evaluate(
            ws,
            """
            (() => {
              if (typeof pause === 'function') { try { pause(); } catch(e) {} }
              else if (window.state) { state.playing = false; }
              if (typeof updateSessionChrome === 'function') updateSessionChrome();
              if (typeof showMode === 'function') showMode();
              return true;
            })()
            """,
        )
        time.sleep(0.4)
        screenshot(ws, out_dir / "session-paused.png", 390, 844)

        # progress / status close-ish: keep session running look with fake progress
        evaluate(
            ws,
            """
            (() => {
              if (window.state) {
                state.playing = true;
                state.mode = 'session';
                state.elapsed = 420;
                state.duration = 900;
                state.timerSeconds = 900;
              }
              if (typeof updateProgress === 'function') updateProgress();
              if (typeof updateSessionChrome === 'function') updateSessionChrome();
              return true;
            })()
            """,
        )
        time.sleep(0.3)
        screenshot(ws, out_dir / "session-progress.png", 390, 844)

        # open sound overlay if available
        evaluate(
            ws,
            """
            (() => {
              const b = document.querySelector('#soundButton');
              if (b) b.click();
              else if (typeof modal === 'function') modal('soundOverlay');
              return true;
            })()
            """,
        )
        time.sleep(0.5)
        screenshot(ws, out_dir / "sound-panel.png", 390, 844)

        # close overlay and show result
        evaluate(
            ws,
            """
            (() => {
              if (typeof closeModal === 'function') closeModal();
              const app = document.querySelector('.app');
              if (app) {
                app.classList.remove('audio-loading');
                app.classList.add('world-ready');
                app.dataset.session = 'done';
              }
              document.querySelectorAll('.asset-status,#bootLoader').forEach(el => {
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
              });
              const ov = document.querySelector('#resultOverlay');
              if (ov) ov.hidden = false;
              const label = document.querySelector('#statusLabel');
              if (label) label.textContent = '已完成';
              const status = document.querySelector('#sessionStatus');
              if (status) status.dataset.state = 'done';
              return true;
            })()
            """,
        )
        time.sleep(0.4)
        screenshot(ws, out_dir / "result.png", 390, 844)

        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


def main():
    for label, (url, out_dir, port) in TARGETS.items():
        print("capturing", label, url)
        capture_target(label, url, out_dir, port)
    print("done")


if __name__ == "__main__":
    main()
