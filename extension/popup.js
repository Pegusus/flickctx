async function refresh() {
  const el = document.getElementById("status");
  try {
    const res = await fetch("http://127.0.0.1:19234/v1/health");
    const data = await res.json();
    if (data.ok) {
      el.className = "ok";
      el.textContent = data.extensionConnected
        ? `Connected · port ${data.port}`
        : `Desktop listening · waiting for extension heartbeat`;
    } else {
      el.className = "bad";
      el.textContent = "Unexpected health response";
    }
  } catch {
    el.className = "bad";
    el.textContent = "Desktop app not running (start Flickctx / npm start)";
  }
}

refresh();
setInterval(refresh, 1500);
