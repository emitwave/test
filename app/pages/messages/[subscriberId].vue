<script setup lang="ts">
import type { PresenceChannel, PresenceInfo } from "@emitwave/emitwavejs";

const emitwave = useEmitWave();
const route = useRoute();
const subscriberId = route.params.subscriberId as string;

const status = ref<string>("disconnected");
const messages = ref<Array<{ data: unknown; time: string }>>([]);
const members = ref<PresenceInfo[]>([]);
const activityLog = ref<Array<{ type: "join" | "leave"; user: PresenceInfo; time: string }>>([]);
const historyLoaded = ref(false);
const errorMessage = ref<string | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

let channel: PresenceChannel | null = null;

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
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
  errorMessage.value = err.message;
});

onMounted(async () => {
  try {
    status.value = "connecting";
    await emitwave.connect({
      subscriberId,
      subscriberAccessToken: route.query.access_token as string | undefined,
      subscriberRefreshToken: route.query.refresh_token as string | undefined,
    });

    channel = (await emitwave.presence("company.chat-room")) as PresenceChannel;

    channel.on("message", (data) => {
      messages.value.push({
        data,
        time: new Date().toLocaleTimeString(),
      });
      scrollToBottom();
    });

    channel.on("subscribe", () => {
      console.log("[EmitWave] Subscribed to company.chat-room");
    });

    channel.on("error", (err) => {
      console.error("[EmitWave] Channel error:", err);
      errorMessage.value = err.message;
    });

    channel.on("join", async (info: PresenceInfo) => {
      activityLog.value.unshift({
        type: "join",
        user: info,
        time: new Date().toLocaleTimeString(),
      });
      if (activityLog.value.length > 10) {
        activityLog.value = activityLog.value.slice(0, 10);
      }
      members.value = await channel!.members();
    });

    channel.on("leave", async (info: PresenceInfo) => {
      activityLog.value.unshift({
        type: "leave",
        user: info,
        time: new Date().toLocaleTimeString(),
      });
      if (activityLog.value.length > 10) {
        activityLog.value = activityLog.value.slice(0, 10);
      }
      members.value = await channel!.members();
    });

    channel.subscribe();
    members.value = await channel.members();

    const history = await channel.history(50);
    for (const item of history) {
      messages.value.push({
        data: item,
        time: "history",
      });
    }
    historyLoaded.value = true;
    scrollToBottom();
  } catch (err: any) {
    console.error("[EmitWave] Connection failed:", err);
    status.value = "error";
    errorMessage.value = err.message ?? String(err);
  }
});

onUnmounted(() => {
  channel?.unsubscribe();
  emitwave.disconnect();
});

const statusColor = computed(() => {
  if (status.value === "connected") return "#22c55e";
  if (status.value === "connecting") return "#f59e0b";
  return "#ef4444";
});
</script>

<template>
  <div style="height: 100vh; display: flex; flex-direction: column; font-family: system-ui, sans-serif; margin: 0;">
    <!-- Error Banner -->
    <div
      v-if="errorMessage"
      style="background: #fef2f2; color: #dc2626; padding: 0.5rem 1rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #fecaca;"
    >
      <span>{{ errorMessage }}</span>
      <button
        style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 1.2rem; padding: 0 0.5rem;"
        @click="errorMessage = null"
      >
        &times;
      </button>
    </div>

    <!-- Header -->
    <div style="background: #1a1a2e; color: #fff; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-shrink: 0;">
      <h1 style="margin: 0; font-size: 1.25rem; font-weight: 700;">EmitWave Chat</h1>
      <span
        :style="{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: statusColor,
          display: 'inline-block',
          flexShrink: '0',
        }"
      />
      <span style="font-size: 0.85rem; opacity: 0.7;">{{ status }}</span>
      <span style="margin-left: auto; font-size: 0.85rem; opacity: 0.7;">{{ subscriberId }} | company.chat-room</span>
    </div>

    <!-- Main Content -->
    <div style="display: flex; flex: 1; min-height: 0;">
      <!-- Sidebar -->
      <div style="width: 260px; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; background: #fff; flex-shrink: 0;">
        <!-- Members -->
        <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb; flex: 1; overflow-y: auto;">
          <h3 style="margin: 0 0 0.75rem; font-size: 0.85rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">
            Online ({{ members.length }})
          </h3>
          <div v-if="members.length === 0" style="color: #9ca3af; font-size: 0.85rem; text-align: center; padding: 1rem 0;">
            No members yet.
          </div>
          <div
            v-for="(member, i) in members"
            :key="member.clientId ?? i"
            style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; font-size: 0.9rem;"
          >
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0;" />
            <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ member.userId }}</span>
          </div>
        </div>

        <!-- Activity Log -->
        <div style="padding: 1rem; overflow-y: auto; flex: 1;">
          <h3 style="margin: 0 0 0.75rem; font-size: 0.85rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">
            Activity Log
          </h3>
          <div v-if="activityLog.length === 0" style="color: #9ca3af; font-size: 0.85rem; text-align: center; padding: 1rem 0;">
            No activity yet.
          </div>
          <div
            v-for="(entry, i) in activityLog"
            :key="i"
            style="font-size: 0.8rem; padding: 0.3rem 0; border-bottom: 1px solid #f3f4f6;"
          >
            <span :style="{ color: entry.type === 'join' ? '#22c55e' : '#ef4444', fontWeight: '600' }">
              {{ entry.type === "join" ? "+" : "-" }}
            </span>
            <span style="color: #374151;"> {{ entry.user.userId }}</span>
            <span style="color: #9ca3af; margin-left: 0.25rem;">{{ entry.time }}</span>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div style="flex: 1; display: flex; flex-direction: column; min-width: 0; background: #f9fafb;">
        <!-- History indicator -->
        <div
          v-if="historyLoaded && messages.length > 0"
          style="text-align: center; padding: 0.5rem; font-size: 0.75rem; color: #9ca3af; border-bottom: 1px solid #e5e7eb;"
        >
          History loaded
        </div>

        <!-- Messages -->
        <div
          ref="messagesContainer"
          style="flex: 1; overflow-y: auto; padding: 1rem;"
        >
          <div
            v-if="messages.length === 0"
            style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;"
          >
            No messages yet.
          </div>
          <div
            v-for="(msg, i) in messages"
            :key="i"
            style="margin-bottom: 0.75rem; max-width: 80%;"
          >
            <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.9rem;">{{ JSON.stringify(msg.data, null, 2) }}</pre>
            </div>
            <div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem; padding-left: 0.25rem;">
              {{ msg.time }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 0.75rem 1rem; border-top: 1px solid #e5e7eb; background: #fff; font-size: 0.85rem; color: #6b7280; flex-shrink: 0;">
          Connected as: <strong style="color: #374151;">{{ subscriberId }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>
