<script setup lang="ts">
import type { Channel, ConnectOptions } from "@emitwave/emitwavejs";

const emitwave = useEmitWave();

const status = ref<string>("disconnected");
const subscriberExternalId = "sub_33PzseupokdqzIiAo2tAS";
const channelName = ref(`user.${subscriberExternalId}`);
const publishChannelName = computed(() => `private-${channelName.value}`);
const messages = ref<Array<{ event: string; data: unknown; time: string }>>([]);
const pushStatus = ref<string>("not initialized");
const pushError = ref<string>("");
const pushDiagnostics = ref({
  permissionStatus: "unknown",
  serviceWorkerScript: "unknown",
  hasBrowserSubscription: false,
  visibleNotificationCount: 0,
});
const isSubscriberLoggedIn = ref(false);
const expandedMessage = ref<{
  event: string;
  data: unknown;
  time: string;
} | null>(null);
let channel: Channel | null = null;
let subscriberConnectOptions: ConnectOptions | null = null;
let serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null;

interface EmitWaveServiceWorkerMessage {
  type?: string;
  payload?: unknown;
}

interface BrowserPushConfigResponse {
  data: {
    vapidKey?: string;
    vapid_key?: string;
    serviceWorkerPath?: string;
    service_worker_path?: string;
    serviceWorkerScope?: string;
    service_worker_scope?: string;
    site: {
      id: string;
    };
  };
}

interface PushSubscriptionResponse {
  data: {
    subscriptionId?: string;
    subscription_id?: string;
  };
}

async function ensureSubscriberLogin() {
  if (isSubscriberLoggedIn.value && subscriberConnectOptions) {
    return subscriberConnectOptions;
  }

  pushStatus.value = "logging in subscriber";
  const connectOptions = await loginEmitWaveSubscriber(subscriberExternalId);
  subscriberConnectOptions = connectOptions;
  isSubscriberLoggedIn.value = true;

  return connectOptions;
}

function recordMessage(event: string, data: unknown) {
  messages.value.unshift({
    event,
    data,
    time: new Date().toLocaleTimeString(),
  });
}

async function refreshPushDiagnostics(registration?: ServiceWorkerRegistration) {
  pushDiagnostics.value.permissionStatus =
    "Notification" in window ? Notification.permission : "unsupported";

  if (!("serviceWorker" in navigator)) {
    pushDiagnostics.value.serviceWorkerScript = "unsupported";
    pushDiagnostics.value.hasBrowserSubscription = false;
    pushDiagnostics.value.visibleNotificationCount = 0;
    return;
  }

  const activeRegistration = registration || (await navigator.serviceWorker.ready);
  const subscription = await activeRegistration.pushManager.getSubscription();
  const notifications = await activeRegistration.getNotifications();

  pushDiagnostics.value.serviceWorkerScript =
    activeRegistration.active?.scriptURL ||
    activeRegistration.installing?.scriptURL ||
    activeRegistration.waiting?.scriptURL ||
    "unknown";
  pushDiagnostics.value.hasBrowserSubscription = Boolean(subscription);
  pushDiagnostics.value.visibleNotificationCount = notifications.length;
}

function handleServiceWorkerMessage(event: MessageEvent) {
  const data = event.data as EmitWaveServiceWorkerMessage;
  if (!data?.type?.startsWith("emitwave.push.")) {
    return;
  }

  if (data.type === "emitwave.push.displayed") {
    const payload = data.payload as { notification_count?: number };
    pushDiagnostics.value.visibleNotificationCount =
      payload.notification_count ?? pushDiagnostics.value.visibleNotificationCount;
    recordMessage("push.displayed", data.payload);
  }

  if (data.type === "emitwave.push.display_failed") {
    recordMessage("push.display_failed", data.payload);
  }
}

emitwave.on("connected", () => {
  status.value = "connected";
});

emitwave.on("disconnected", () => {
  status.value = "disconnected";
});

emitwave.on("connecting", () => {
  status.value = "connecting";
});

emitwave.on("error", (err) => {
  console.error("[EmitWave] Error:", err);
});

onMounted(async () => {
  try {
    status.value = "connecting";
    pushStatus.value = emitwave.push.getPermissionStatus();
    pushDiagnostics.value.permissionStatus = pushStatus.value;

    if ("serviceWorker" in navigator) {
      serviceWorkerMessageHandler = handleServiceWorkerMessage;
      navigator.serviceWorker.addEventListener("message", serviceWorkerMessageHandler);
    }

    emitwave.push.onNotificationReceived((payload) => {
      recordMessage("push.received", payload);
    });
    emitwave.push.onNotificationOpened((payload) => {
      recordMessage("push.opened", payload);
    });

    const connectOptions = await ensureSubscriberLogin();
    await emitwave.connect(connectOptions);

    channel = (await emitwave.private(channelName.value)) as Channel;

    channel.on("message", (data) => {
      recordMessage("raw", data);
    });

    channel.listen("notification.created", (data) => {
      recordMessage("notification.created", data);
    });

    channel.listen("test.event", (data) => {
      recordMessage("test.event", data);
    });
  } catch (err) {
    console.error("[EmitWave] Connection failed:", err);
    status.value = "error";
    pushStatus.value = "login required";
    pushError.value = err instanceof Error ? err.message : String(err);
  }
});

async function enableNotifications() {
  try {
    pushError.value = "";
    pushStatus.value = "clicked";

    if (!("serviceWorker" in navigator)) {
      throw new Error("This browser does not support service workers.");
    }
    if (!("Notification" in window)) {
      throw new Error("This browser does not support notifications.");
    }
    if (!("PushManager" in window)) {
      throw new Error("This browser does not support Web Push.");
    }

    await ensureSubscriberLogin();

    pushStatus.value = "loading push config";
    const pushConfig = await getBrowserPushConfig();
    const vapidKey = pushConfig.vapidKey || pushConfig.vapid_key;
    if (!vapidKey) {
      throw new Error("Browser push config is missing vapidKey.");
    }

    pushStatus.value = "registering service worker";
    const registration = await navigator.serviceWorker.register(
      pushConfig.serviceWorkerPath || pushConfig.service_worker_path || "/emitwave-sw.js",
      {
        scope: pushConfig.serviceWorkerScope || pushConfig.service_worker_scope || "/",
      },
    );
    await navigator.serviceWorker.ready;
    await refreshPushDiagnostics(registration);

    pushStatus.value = "requesting permission";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(`Notification permission is ${permission}.`);
    }

    pushStatus.value = "creating browser subscription";
    const browserSubscription = await getOrCreatePushSubscription(
      registration,
      vapidKey,
    );

    pushStatus.value = "creating EmitWave subscription";
    const subscription = await registerEmitWavePushSubscription(
      pushConfig.site.id,
      browserSubscription,
    );
    pushStatus.value = `enabled (${subscription.subscriptionId || subscription.subscription_id})`;
    await refreshPushDiagnostics(registration);
  } catch (err) {
    console.error("[EmitWave] Push registration failed:", err);
    pushStatus.value = emitwave.push.getPermissionStatus();
    pushError.value = err instanceof Error ? err.message : String(err);
  }
}

async function getBrowserPushConfig() {
  const config = useRuntimeConfig();
  const apiUrl = String(config.public.emitwaveApiUrl).replace(/\/$/, "");
  const publicKey = String(config.public.emitwavePublicKey);

  const response = await $fetch<BrowserPushConfigResponse>(
    `${apiUrl}/v1/push/browser/config`,
    {
      headers: {
        Authorization: `Bearer ${publicKey}`,
      },
    },
  );

  return response.data;
}

async function getOrCreatePushSubscription(
  registration: ServiceWorkerRegistration,
  vapidKey: string,
) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer,
  });
}

async function registerEmitWavePushSubscription(
  siteId: string,
  subscription: PushSubscription,
) {
  const config = useRuntimeConfig();
  const apiUrl = String(config.public.emitwaveApiUrl).replace(/\/$/, "");
  const publicKey = String(config.public.emitwavePublicKey);
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) {
    throw new Error("Browser PushSubscription is missing keys.");
  }

  const response = await $fetch<PushSubscriptionResponse>(
    `${apiUrl}/v1/push/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicKey}`,
      },
      body: {
        externalId: subscriberExternalId,
        siteId,
        platform: "web",
        provider: "web_push",
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
        permissionStatus: Notification.permission,
        enabled: true,
        device: deviceMetadata(),
      },
    },
  );

  const subscriptionId = response.data.subscriptionId || response.data.subscription_id;
  if (subscriptionId) {
    localStorage.setItem("emitwave.push.subscription_id", subscriptionId);
  }

  return response.data;
}

function deviceMetadata() {
  return {
    deviceId: getDeviceId(),
    browser: navigator.userAgent,
    browserVersion: "",
    os: navigator.platform || "",
    osVersion: "",
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    userAgent: navigator.userAgent,
  };
}

function getDeviceId() {
  const key = "emitwave.push.device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      globalThis.crypto?.randomUUID?.() ||
      `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

onUnmounted(() => {
  if (serviceWorkerMessageHandler && "serviceWorker" in navigator) {
    navigator.serviceWorker.removeEventListener("message", serviceWorkerMessageHandler);
  }
  channel?.unsubscribe();
  emitwave.disconnect();
});

const expandedPayload = computed(() =>
  expandedMessage.value
    ? JSON.stringify(expandedMessage.value.data, null, 2)
    : "",
);
</script>

<template>
  <div
    style="
      max-width: 600px;
      margin: 2rem auto;
      font-family: system-ui, sans-serif;
    "
  >
    <h1>EmitWave Private User Channel Test</h1>

    <div style="margin-bottom: 1rem">
      <strong>Status:</strong>
      <span
        :style="{
          color:
            status === 'connected'
              ? 'green'
              : status === 'connecting'
                ? 'orange'
                : 'red',
          fontWeight: 'bold',
        }"
      >
        {{ status }}
      </span>
    </div>

    <div style="margin-bottom: 1rem">
      <strong>SDK channel:</strong>
      <code>{{ channelName }}</code>
    </div>

    <div
      style="
        margin-bottom: 1rem;
        padding: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
      "
    >
      <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap">
        <strong>Push:</strong>
        <span>{{ pushStatus }}</span>
        <button
          type="button"
          style="
            border: 1px solid #0f172a;
            background: #0f172a;
            color: #fff;
            border-radius: 4px;
            padding: 0.45rem 0.7rem;
            cursor: pointer;
            font-size: 0.9rem;
          "
          @click="enableNotifications"
        >
          Enable notifications
        </button>
      </div>
      <div v-if="pushError" style="margin-top: 0.5rem; color: #b91c1c">
        {{ pushError }}
      </div>
      <div
        style="
          margin-top: 0.75rem;
          display: grid;
          gap: 0.35rem;
          font-size: 0.85rem;
          color: #475569;
        "
      >
        <div>
          <strong>Permission:</strong>
          <span>{{ pushDiagnostics.permissionStatus }}</span>
        </div>
        <div>
          <strong>Service worker:</strong>
          <code style="word-break: break-all">{{ pushDiagnostics.serviceWorkerScript }}</code>
        </div>
        <div>
          <strong>Browser subscription:</strong>
          <span>{{ pushDiagnostics.hasBrowserSubscription ? "present" : "missing" }}</span>
        </div>
        <div>
          <strong>Visible notifications:</strong>
          <span>{{ pushDiagnostics.visibleNotificationCount }}</span>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 1rem">
      <strong>Publish channel:</strong>
      <code>{{ publishChannelName }}</code>
    </div>

    <div
      style="
        margin-bottom: 1rem;
        padding: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
      "
    >
      Publish with:
      <pre style="margin: 0.5rem 0 0; white-space: pre-wrap">
POST /v1/realtime/publish
{
  "channels": "{{ publishChannelName }}",
  "event": "notification.created",
  "data": {
    "message": "Hello private user"
  }
}</pre
      >
    </div>

    <div>
      <h2>Messages ({{ messages.length }})</h2>
      <div
        v-if="messages.length === 0"
        style="
          color: #888;
          padding: 1rem;
          text-align: center;
          border: 1px dashed #ccc;
          border-radius: 4px;
        "
      >
        No messages yet.
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        style="
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #f5f5f5;
          border-radius: 4px;
        "
      >
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          "
        >
          <div style="font-size: 0.85rem; color: #666">
            {{ msg.time }} — {{ msg.event }}
          </div>
          <button
            type="button"
            style="
              border: 1px solid #cbd5e1;
              background: #fff;
              color: #0f172a;
              border-radius: 4px;
              padding: 0.3rem 0.55rem;
              cursor: pointer;
              font-size: 0.8rem;
              flex-shrink: 0;
            "
            @click="expandedMessage = msg"
          >
            Expand
          </button>
        </div>
        <pre
          style="
            margin: 0.25rem 0 0;
            white-space: pre-wrap;
            max-height: 160px;
            overflow: auto;
          "
          >{{ JSON.stringify(msg.data, null, 2) }}</pre
        >
      </div>
    </div>

    <div
      v-if="expandedMessage"
      style="
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.62);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 50;
      "
      @click.self="expandedMessage = null"
    >
      <div
        style="
          width: min(960px, 100%);
          max-height: min(760px, 90vh);
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        "
      >
        <div
          style="
            padding: 1rem;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
          "
        >
          <div>
            <div style="font-weight: 700">{{ expandedMessage.event }}</div>
            <div style="font-size: 0.85rem; color: #64748b">
              {{ expandedMessage.time }} — {{ publishChannelName }}
            </div>
          </div>
          <button
            type="button"
            style="
              border: 1px solid #cbd5e1;
              background: #fff;
              border-radius: 4px;
              padding: 0.45rem 0.7rem;
              cursor: pointer;
              flex-shrink: 0;
            "
            @click="expandedMessage = null"
          >
            Close
          </button>
        </div>
        <pre
          style="
            margin: 0;
            padding: 1rem;
            overflow: auto;
            white-space: pre-wrap;
            font-size: 0.9rem;
            line-height: 1.5;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 360px;
          "
          >{{ expandedPayload }}</pre
        >
      </div>
    </div>
  </div>
</template>
