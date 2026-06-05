<script setup lang="ts">
const emitwave = useEmitWave();

const subscriberExternalId = "sub_33PzseupokdqzIiAo2tAS";
const pushStatus = ref<string>("not initialized");
const pushError = ref<string>("");
const pushDiagnostics = ref({
  permissionStatus: "unknown",
  serviceWorkerScript: "unknown",
  hasBrowserSubscription: false,
  visibleNotificationCount: 0,
});
const messages = ref<Array<{ event: string; data: unknown; time: string }>>([]);
const expandedMessage = ref<{
  event: string;
  data: unknown;
  time: string;
} | null>(null);
let serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null;

interface EmitWaveServiceWorkerMessage {
  type?: string;
  payload?: unknown;
}

function recordMessage(event: string, data: unknown) {
  messages.value.unshift({
    event,
    data,
    time: new Date().toLocaleTimeString(),
  });
}

async function refreshPushDiagnostics(
  registration?: ServiceWorkerRegistration,
) {
  const diagnostics = await emitwave.push.getDiagnostics(registration);
  pushDiagnostics.value = diagnostics;
}

function handleServiceWorkerMessage(event: MessageEvent) {
  const data = event.data as EmitWaveServiceWorkerMessage;
  if (!data?.type?.startsWith("emitwave.push.")) {
    return;
  }

  if (data.type === "emitwave.push.displayed") {
    const payload = data.payload as { notification_count?: number };
    pushDiagnostics.value.visibleNotificationCount =
      payload.notification_count ??
      pushDiagnostics.value.visibleNotificationCount;
    recordMessage("push.displayed", data.payload);
  }

  if (data.type === "emitwave.push.display_failed") {
    recordMessage("push.display_failed", data.payload);
  }
}

onMounted(async () => {
  try {
    pushStatus.value = emitwave.push.getPermissionStatus();
    pushDiagnostics.value.permissionStatus = pushStatus.value;

    if ("serviceWorker" in navigator) {
      serviceWorkerMessageHandler = handleServiceWorkerMessage;
      navigator.serviceWorker.addEventListener(
        "message",
        serviceWorkerMessageHandler,
      );
      await refreshPushDiagnostics();
    }

    emitwave.push.onNotificationReceived((payload) => {
      recordMessage("push.received", payload);
    });
    emitwave.push.onNotificationOpened((payload) => {
      recordMessage("push.opened", payload);
    });
  } catch (err) {
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

    pushStatus.value = "logging in subscriber";
    await loginEmitWaveSubscriber(subscriberExternalId);

    pushStatus.value = "registering push";
    const subscription = await emitwave.push.register();
    pushStatus.value = `enabled (${subscription.subscriptionId})`;
    await refreshPushDiagnostics();
  } catch (err) {
    console.error("[EmitWave] Push registration failed:", err);
    pushStatus.value = emitwave.push.getPermissionStatus();
    pushError.value = err instanceof Error ? err.message : String(err);
  }
}

onUnmounted(() => {
  if (serviceWorkerMessageHandler && "serviceWorker" in navigator) {
    navigator.serviceWorker.removeEventListener(
      "message",
      serviceWorkerMessageHandler,
    );
  }
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
      max-width: 640px;
      margin: 2rem auto;
      font-family: system-ui, sans-serif;
    "
  >
    <NuxtLink to="/">Back to private channel test</NuxtLink>

    <h1>EmitWave Web Push Notification Test</h1>

    <p style="color: #475569; margin-top: -0.5rem">
      Subscriber:
      <code>{{ subscriberExternalId }}</code>
    </p>

    <div
      style="
        margin-bottom: 1rem;
        padding: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        "
      >
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
          <code style="word-break: break-all">{{
            pushDiagnostics.serviceWorkerScript
          }}</code>
        </div>
        <div>
          <strong>Browser subscription:</strong>
          <span>{{
            pushDiagnostics.hasBrowserSubscription ? "present" : "missing"
          }}</span>
        </div>
        <div>
          <strong>Visible notifications:</strong>
          <span>{{ pushDiagnostics.visibleNotificationCount }}</span>
        </div>
      </div>
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
      Send test pushes to:
      <pre style="margin: 0.5rem 0 0; white-space: pre-wrap">
POST /v1/dashboard/web-push/test
{
  "title": "Test notification",
  "body": "Hello web push subscriber"
}</pre
      >
    </div>

    <div>
      <h2>Push Events ({{ messages.length }})</h2>
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
        No push events yet.
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
            {{ msg.time }} - {{ msg.event }}
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
              {{ expandedMessage.time }}
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
