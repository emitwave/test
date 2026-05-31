import { EmitWave } from "@emitwave/emitwavejs";

interface LaravelSubscriberTokenResponse {
  access_token: string;
  refresh_token: string;
}

let instance: EmitWave | null = null;
export function useEmitWave() {
  if (!instance) {
    instance = new EmitWave({
      appId: "ws_33GmR7001GaWM0suD4ZSV",
      publicKey:
        "ew_pk_0c3170978e3ae95d0bd6856d4b628a07c203fad6fd599e756021110828687fd7",
      apiUrl: "http://localhost:8080",
      realtimeUrl: "ws://localhost:8000/connection/websocket",
      debug: true,
    });
  }

  return instance;
}

export async function getSubscriberConnectOptions(subscriberExternalId: string) {
  const config = useRuntimeConfig();
  const baseUrl = String(config.public.laravelUrl).replace(/\/$/, "");
  const token = await $fetch<LaravelSubscriberTokenResponse>(
    `${baseUrl}/emitwave/subscriber-token`,
    {
      method: "POST",
      body: {
        subscriber_external_id: subscriberExternalId,
      },
    },
  );

  return {
    subscriberExternalId,
    subscriberAccessToken: token.access_token,
    subscriberRefreshToken: token.refresh_token,
  };
}
