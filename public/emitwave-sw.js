/* EmitWave native Web Push service worker runtime. Publish this file to the EmitWave CDN. */
let emitwaveConfig = {};
self.EmitWaveSW = { init(config = {}) { emitwaveConfig = { ...emitwaveConfig, ...config }; } };
self.EmitWaveSW.init({ publicKey: "ew_pk_381db91f51a310b0d06c3646f17de02b383a1d19f3b850f750471fc4ada413e6" });
self.addEventListener("push", (event) => event.waitUntil(handlePush(event)));
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(handleClick(event)); });

async function handlePush(event) {
  const payload = event.data ? event.data.json() : {};
  await self.registration.showNotification(payload.title || "Notification", {
    body: payload.body || "", icon: payload.icon, badge: payload.badge, image: payload.image,
    actions: payload.actions, tag: payload.tag, renotify: payload.renotify,
    requireInteraction: payload.require_interaction, data: payload,
  });
  await notifyPages("emitwave.push.received", payload);
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
