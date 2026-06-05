// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  vite: {
    server: {
      allowedHosts: [
        "silent-feet-sleep.loca.lt",
        "legal-mirrors-dance.loca.lt",
        "https://wide-actors-train.loca.lt",
      ],
    },
  },
  runtimeConfig: {
    public: {
      laravelUrl:
        process.env.NUXT_PUBLIC_LARAVEL_URL || "http://localhost:8080",
      emitwaveApiUrl:
        process.env.NUXT_PUBLIC_EMITWAVE_API_URL || "http://localhost:8080",
      emitwaveRealtimeUrl:
        process.env.NUXT_PUBLIC_EMITWAVE_REALTIME_URL ||
        "ws://localhost:8000/connection/websocket",
      emitwaveAppId:
        process.env.NUXT_PUBLIC_EMITWAVE_APP_ID || "ws_33GmR7001GaWM0suD4ZSV",
      emitwavePublicKey:
        process.env.NUXT_PUBLIC_EMITWAVE_PUBLIC_KEY ||
        "ew_pk_381db91f51a310b0d06c3646f17de02b383a1d19f3b850f750471fc4ada413e6",
    },
  },
});
