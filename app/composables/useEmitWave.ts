import { EmitWave } from "@emitwave/emitwavejs";

const subscriberAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODAxNTEyODIsImlhdCI6MTc4MDE0NzY4MiwianRpIjoiMDE5ZTc5MTEtZmNhNC03NWRjLWE4M2ItNDA4MWFkNWNkMzk3Iiwib3JnX2lkIjoiMDE5ZTI4NjgtYjA0Ny03NjJhLWEyMmQtZTNiODU2YTU3NWEzIiwic3ViIjoiMDE5ZTNjMWQtOGU4Yy03MDhjLTlmMWYtZmRjMzUwMzViYzU5Iiwic3Vic2NyaWJlcl9pZCI6IjAxOWUzYzFkLThlOGMtNzA5NC1iYTRlLWY0ZmMxZjc1NDk1YiIsInR5cCI6InN1YnNjcmliZXJfYWNjZXNzIn0.x4iZWc9jfEz5O9RGxV5IJ1yNOMyLChEvFZumpeo-V38";
const subscriberRefreshToken =
  "ewr_b7660a8df5475dab53c345cb59dd2cd90f6857e1d863aeda559939afb8b2b9cb";

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
