import { EmitWave } from "@emitwave/emitwavejs";

interface LaravelSubscriberTokenResponse {
  access_token: string;
  refresh_token: string;
}

interface SubscriberLoginTokens {
  accessToken: string;
  refreshToken: string;
}

let instance: EmitWave | null = null;
export function useEmitWave() {
  if (!instance) {
    const config = useRuntimeConfig();
    instance = new EmitWave({
      appId: String(config.public.emitwaveAppId),
      publicKey: String(config.public.emitwavePublicKey),
      apiUrl: String(config.public.emitwaveApiUrl),
      realtimeUrl: String(config.public.emitwaveRealtimeUrl),
      debug: true,
    });
  }

  return instance;
}

export async function getSubscriberLoginTokens(
  subscriberExternalId: string,
): Promise<SubscriberLoginTokens> {
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
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  };
}

export async function loginEmitWaveSubscriber(subscriberExternalId: string) {
  const emitwave = useEmitWave();
  const tokens = await getSubscriberLoginTokens(subscriberExternalId);

  await emitwave.login(subscriberExternalId, tokens);

  return {
    subscriberExternalId,
    subscriberAccessToken: tokens.accessToken,
    subscriberRefreshToken: tokens.refreshToken,
  };
}

export async function getSubscriberConnectOptions(subscriberExternalId: string) {
  return loginEmitWaveSubscriber(subscriberExternalId);
}
