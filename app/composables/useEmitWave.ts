import { EmitWave } from "@emitwave/emitwavejs";

const subscriberAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODAxNDE4MzYsImlhdCI6MTc4MDEzODIzNiwianRpIjoiMDE5ZTc4ODEtZDhhNi03YTU4LTlmMjctYWEyZGNjZTQzYWQxIiwib3JnX2lkIjoiMDE5ZTI4NjgtYjA0Ny03NjJhLWEyMmQtZTNiODU2YTU3NWEzIiwic3ViIjoiMDE5ZTNjMWQtOGU4Yy03MDk0LWJhNGUtZjRmYzFmNzU0OTViIiwidHlwIjoic3Vic2NyaWJlcl9hY2Nlc3MifQ.iwkTdykUZPsDtIP_HTLAil23aO15dsMv3rvKbTkSe7Y";
const subscriberRefreshToken =
  "ewr_38017eda761b2e1b1d7b4c647fe1a20c557f501f9b809e9df55d7a7cc02d7505";

let instance: EmitWave | null = null;
export function useEmitWave() {
  if (!instance) {
    instance = new EmitWave({
      appId: "ws_33GmR7001GaWM0suD4ZSV",
      publicKey:
        "ew_pk_ee0160fb4cbf46883947def4778f998c866919a7d3cf38b44b4ea34c06917cad",
      apiUrl: "http://localhost:8080",
      realtimeUrl: "ws://localhost:8000/connection/websocket",
      subscriberAccessToken,
      subscriberRefreshToken,
      debug: true,
    });
  }

  return instance;
}
