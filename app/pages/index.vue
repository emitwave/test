<script setup lang="ts">
import type { Channel, ConnectOptions } from "@emitwave/emitwavejs";

const emitwave = useEmitWave();

const status = ref<string>("disconnected");
const subscriberExternalId = "sub_33PzseupokdqzIiAo2tAS";
const channelName = ref(`user.${subscriberExternalId}`);
const publishChannelName = computed(() => `private-${channelName.value}`);
const messages = ref<Array<{ event: string; data: unknown; time: string }>>([]);
const isSubscriberLoggedIn = ref(false);
const expandedMessage = ref<{
  event: string;
  data: unknown;
  time: string;
} | null>(null);
let channel: Channel | null = null;
let subscriberConnectOptions: ConnectOptions | null = null;

async function ensureSubscriberLogin() {
  if (isSubscriberLoggedIn.value && subscriberConnectOptions) {
    return subscriberConnectOptions;
  }

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
  }
});

onUnmounted(() => {
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

    <p style="margin-top: -0.5rem; color: #475569">
      Looking for web push?
      <NuxtLink to="/web-push-notification">Open the Web Push Notification test</NuxtLink>.
    </p>

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
