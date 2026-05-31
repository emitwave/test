<script setup lang="ts">
import type { PresenceChannel, PresenceInfo } from "@emitwave/emitwavejs";

const emitwave = useEmitWave();

const status = ref<string>("disconnected");
const members = ref<PresenceInfo[]>([]);
const activityLog = ref<
  Array<{ type: "join" | "leave"; user: PresenceInfo; time: string }>
>([]);
let channel: PresenceChannel | null = null;

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

const route = useRoute();
const presenceName = "user.019e3c1d-8e8c-708c-9f1f-fdc35035bc59";
const backendPresenceName = "presence-company.test-room";

onMounted(async () => {
  try {
    status.value = "connecting";
    const subscriberExternalId =
      (route.query.subscriber as string) ||
      "019e3c1d-8e8c-708c-9f1f-fdc35035bc59";
    await emitwave.connect(await getSubscriberConnectOptions(subscriberExternalId));

    channel = (await emitwave.presence(presenceName)) as PresenceChannel;

    channel.on("join", async (info: PresenceInfo) => {
      activityLog.value.unshift({
        type: "join",
        user: info,
        time: new Date().toLocaleTimeString(),
      });
      members.value = await channel!.members();
    });

    channel.on("leave", async (info: PresenceInfo) => {
      activityLog.value.unshift({
        type: "leave",
        user: info,
        time: new Date().toLocaleTimeString(),
      });
      members.value = await channel!.members();
    });

    channel.subscribe();
    members.value = await channel.members();
  } catch (err) {
    console.error("[EmitWave] Connection failed:", err);
    status.value = "error";
  }
});

onUnmounted(() => {
  channel?.unsubscribe();
  emitwave.disconnect();
});
</script>

<template>
  <div
    style="
      max-width: 600px;
      margin: 2rem auto;
      font-family: system-ui, sans-serif;
    "
  >
    <h1>Presence Channel Test</h1>

    <p style="color: #555; margin-top: -0.5rem">
      SDK channel: <code>{{ presenceName }}</code> · Backend channel:
      <code>{{ backendPresenceName }}</code>
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

    <div style="margin-bottom: 1.5rem">
      <h2>Members ({{ members.length }})</h2>
      <div
        v-if="members.length === 0"
        style="
          color: #888;
          padding: 1rem;
          text-align: center;
          border: 1px dashed #ccc;
          border-radius: 4px;
        "
      >
        No members yet.
      </div>
      <div
        v-for="(member, i) in members"
        :key="member.clientId ?? i"
        style="
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #f5f5f5;
          border-radius: 4px;
        "
      >
        <span style="font-weight: 600">{{ member.userId }}</span>
        <span style="color: #888"> — {{ member.clientId }}</span>
      </div>
    </div>

    <div>
      <h2>Activity Log ({{ activityLog.length }})</h2>
      <div
        v-if="activityLog.length === 0"
        style="
          color: #888;
          padding: 1rem;
          text-align: center;
          border: 1px dashed #ccc;
          border-radius: 4px;
        "
      >
        No activity yet.
      </div>
      <div
        v-for="(entry, i) in activityLog"
        :key="i"
        style="
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #f5f5f5;
          border-radius: 4px;
        "
      >
        <span style="font-size: 0.85rem; color: #666">{{ entry.time }}</span>
        <span> — </span>
        <span
          :style="{
            color: entry.type === 'join' ? 'green' : 'red',
            fontWeight: '600',
          }"
        >
          {{ entry.type === "join" ? "joined" : "left" }}:
        </span>
        <span> {{ entry.user.userId }}</span>
      </div>
    </div>
  </div>
</template>
