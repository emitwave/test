/* EmitWave native Web Push service worker runtime. Publish this file to the EmitWave CDN. */
let emitwaveConfig = {};
self.EmitWaveSW = { init(config = {}) { emitwaveConfig = { ...emitwaveConfig, ...config }; } };
self.EmitWaveSW.init({ publicKey: "ew_pk_381db91f51a310b0d06c3646f17de02b383a1d19f3b850f750471fc4ada413e6" });
self.addEventListener("push", (event) => event.waitUntil(handlePush(event)));
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(handleClick(event)); });

async function handlePush(event) {
  const payload = event.data ? event.data.json() : {};
  try {
    await self.registration.showNotification(payload.title || "Notification", notificationOptions(payload));
    const notifications = await self.registration.getNotifications();
    await notifyPages("emitwave.push.displayed", {
      ...payload,
      notification_count: notifications.length,
    });
  } catch (error) {
    await notifyPages("emitwave.push.display_failed", {
      ...payload,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await notifyPages("emitwave.push.received", payload);
}

function notificationOptions(payload) {
  const options = {
    body: payload.body || "",
    data: payload,
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;
  if (payload.image) options.image = payload.image;
  if (Array.isArray(payload.actions) && payload.actions.length) options.actions = payload.actions;
  if (payload.tag) options.tag = payload.tag;
  if (payload.renotify !== undefined) options.renotify = Boolean(payload.renotify);
  if (payload.require_interaction !== undefined) options.requireInteraction = Boolean(payload.require_interaction);

  return options;
}
async function handleClick(event) {
  const payload = event.notification.data || {};
  await track("push.opened", payload);
  if (payload.click_url || event.action) await track("push.clicked", payload);
  await notifyPages("emitwave.push.opened", payload);
  const url = payload.click_url || "/";
  const target = new URL(url, self.location.origin);
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) { if ("focus" in client && new URL(client.url).origin === target.origin) { await client.focus(); if ("navigate" in client) await client.navigate(target.href); return; } }
  if (clients.openWindow) await clients.openWindow(target.href);
}
async function notifyPages(type, payload) { (await clients.matchAll({ type: "window", includeUncontrolled: true })).forEach((client) => client.postMessage({ type, payload })); }
async function track(event, payload) {
  if (!emitwaveConfig.publicKey || !payload.message_id || !payload.subscription_id) return;
  try {
    await fetch("https://api.emitwave.com/v1/push/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${emitwaveConfig.publicKey}` }, body: JSON.stringify({ event, message_id: payload.message_id, subscription_id: payload.subscription_id, data: payload.data || {} }) });
  } catch {}
}
