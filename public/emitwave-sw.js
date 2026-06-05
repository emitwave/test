/* EmitWave browser push service worker. */
const EMITWAVE_DEFAULT_CONFIG = {
  publicKey: "",
  apiBaseUrl: "https://api.emitwave.com",
  debug: false,
};
const EMITWAVE_CONFIG_CACHE = "emitwave-sw-config";
const EMITWAVE_CONFIG_REQUEST = "https://emitwave.local/sw-config";
let emitwaveConfig = { ...EMITWAVE_DEFAULT_CONFIG };

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await loadEmitWaveConfig();
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "emitwave.push.configure") {
    return;
  }

  event.waitUntil(saveEmitWaveConfig(data.config || {}));
});

self.addEventListener("push", (event) => {
  logEmitWave("push event received");
  event.waitUntil(handleEmitWavePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  event.waitUntil(handleEmitWaveNotificationClick(event, payload));
});

async function handleEmitWavePush(event) {
  await loadEmitWaveConfig();
  let payload;
  try {
    payload = readEmitWavePushPayload(event.data);
    logEmitWave("push payload parsed", payload);
  } catch (error) {
    errorEmitWave("push payload parse failed", error);
    payload = {};
  }

  await notifyEmitWavePages("emitwave.push.received", payload);

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

  try {
    await self.registration.showNotification(title, options);
    const notifications = await self.registration.getNotifications();
    const details = {
      title,
      notification_count: notifications.length,
      permission: Notification.permission,
    };
    logEmitWave("notification displayed", details);
    await notifyEmitWavePages("emitwave.push.displayed", { ...payload, ...details });
  } catch (error) {
    const details = {
      title,
      permission: Notification.permission,
      error: error && error.message ? error.message : String(error),
    };
    errorEmitWave("showNotification failed", details);
    await notifyEmitWavePages("emitwave.push.display_failed", { ...payload, ...details });
    throw error;
  }
}

async function handleEmitWaveNotificationClick(event, payload) {
  await loadEmitWaveConfig();
  await Promise.all([
    trackEmitWavePushEvent(payload, "push.opened"),
    payload.click_url || event.action
      ? trackEmitWavePushEvent(payload, "push.clicked")
      : Promise.resolve(),
    notifyEmitWavePages("emitwave.push.opened", payload),
  ]);
  await openEmitWavePushTarget(payload.click_url);
}

function readEmitWavePushPayload(data) {
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
  const publicKey = emitwaveConfig.publicKey || EMITWAVE_DEFAULT_CONFIG.publicKey;
  const apiBaseUrl = trimEmitWaveURL(emitwaveConfig.apiBaseUrl || EMITWAVE_DEFAULT_CONFIG.apiBaseUrl);

  if (!payload || !payload.message_id || !payload.subscription_id || !publicKey || !apiBaseUrl) {
    logEmitWave("tracking skipped", {
      event: eventName,
      has_message_id: Boolean(payload && payload.message_id),
      has_subscription_id: Boolean(payload && payload.subscription_id),
      has_public_key: Boolean(publicKey),
      has_api_base_url: Boolean(apiBaseUrl),
    });
    return;
  }

  try {
    const response = await fetch(apiBaseUrl + "/v1/push/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": publicKey,
      },
      body: JSON.stringify({
        event: eventName,
        message_id: payload.message_id,
        subscription_id: payload.subscription_id,
        data: payload.data || {},
      }),
    });
    logEmitWave("tracking sent", {
      event: eventName,
      status: response.status,
    });
  } catch (error) {
    errorEmitWave("tracking failed", {
      event: eventName,
      error,
    });
  }
}

async function openEmitWavePushTarget(clickURL) {
  const target = normalizeEmitWaveClickURL(clickURL);
  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

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

async function saveEmitWaveConfig(config) {
  emitwaveConfig = {
    ...emitwaveConfig,
    ...normalizeEmitWaveConfig(config),
  };
  await persistEmitWaveConfig();
  logEmitWave("configured", {
    has_public_key: Boolean(emitwaveConfig.publicKey),
    api_base_url: emitwaveConfig.apiBaseUrl,
  });
}

function normalizeEmitWaveConfig(config) {
  const out = {};
  if (typeof config.publicKey === "string") {
    out.publicKey = config.publicKey;
  }
  if (typeof config.apiBaseUrl === "string") {
    out.apiBaseUrl = trimEmitWaveURL(config.apiBaseUrl);
  }
  if (typeof config.debug === "boolean") {
    out.debug = config.debug;
  }
  return out;
}

async function loadEmitWaveConfig() {
  if (!self.caches) {
    return emitwaveConfig;
  }
  try {
    const cache = await caches.open(EMITWAVE_CONFIG_CACHE);
    const response = await cache.match(EMITWAVE_CONFIG_REQUEST);
    if (response) {
      emitwaveConfig = {
        ...emitwaveConfig,
        ...normalizeEmitWaveConfig(await response.json()),
      };
    }
  } catch (error) {
    errorEmitWave("config load failed", error);
  }
  return emitwaveConfig;
}

async function persistEmitWaveConfig() {
  if (!self.caches) {
    return;
  }
  try {
    const cache = await caches.open(EMITWAVE_CONFIG_CACHE);
    await cache.put(
      EMITWAVE_CONFIG_REQUEST,
      new Response(JSON.stringify(emitwaveConfig), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (error) {
    errorEmitWave("config persist failed", error);
  }
}

async function notifyEmitWavePages(type, payload) {
  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windowClients) {
    client.postMessage({ type, payload });
  }
}

function trimEmitWaveURL(value) {
  return String(value || "").replace(/\/+$/, "");
}

function logEmitWave(message, data) {
  if (emitwaveConfig.debug) {
    console.log("[emitwave.sw] " + message, data || "");
  }
}

function errorEmitWave(message, error) {
  if (emitwaveConfig.debug) {
    console.error("[emitwave.sw] " + message, error);
  }
}
