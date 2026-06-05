/* EmitWave browser push service worker. */
const EMITWAVE_PUBLIC_KEY =
  "ew_pk_381db91f51a310b0d06c3646f17de02b383a1d19f3b850f750471fc4ada413e6";
const EMITWAVE_API_BASE_URL = "http://localhost:8080";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(handleEmitWavePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  event.waitUntil(
    Promise.all([
      trackEmitWavePushEvent(payload, "push.clicked"),
      openEmitWavePushTarget(payload.click_url),
    ]),
  );
});

async function handleEmitWavePush(event) {
  const payload = await readEmitWavePushPayload(event.data);
  await trackEmitWavePushEvent(payload, "push.opened");

  const title = payload.title || "Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || undefined,
    badge: payload.badge || undefined,
    image: payload.image || undefined,
    tag: payload.tag || payload.message_id || undefined,
    requireInteraction: Boolean(payload.require_interaction),
    actions: Array.isArray(payload.actions) ? payload.actions : undefined,
    data: payload,
  };

  await self.registration.showNotification(title, options);
}

async function readEmitWavePushPayload(data) {
  if (!data) {
    return {};
  }

  try {
    const payload = data.json();
    if (payload && typeof payload === "object") {
      return payload;
    }
  } catch (_) {
    // Some push providers deliver text bodies. Fall through and display them.
  }

  const text = data.text();
  if (!text) {
    return {};
  }

  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === "object") {
      return payload;
    }
  } catch (_) {
    return { title: text };
  }

  return {};
}

async function trackEmitWavePushEvent(payload, eventName) {
  if (
    !payload ||
    !payload.message_id ||
    !payload.subscription_id ||
    !EMITWAVE_PUBLIC_KEY
  ) {
    return;
  }

  try {
    await fetch(EMITWAVE_API_BASE_URL + "/v1/push/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": EMITWAVE_PUBLIC_KEY,
      },
      body: JSON.stringify({
        event: eventName,
        message_id: payload.message_id,
        subscription_id: payload.subscription_id,
      }),
    });
  } catch (_) {}
}

async function openEmitWavePushTarget(clickURL) {
  const target = normalizeEmitWaveClickURL(clickURL);
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    if ("focus" in client && new URL(client.url).origin === target.origin) {
      await client.focus();
      if ("navigate" in client) {
        await client.navigate(target.href);
      }
      return;
    }
  }

  if (self.clients.openWindow) {
    await self.clients.openWindow(target.href);
  }
}

function normalizeEmitWaveClickURL(clickURL) {
  try {
    return new URL(clickURL || "/", self.location.origin);
  } catch (_) {
    return new URL("/", self.location.origin);
  }
}
