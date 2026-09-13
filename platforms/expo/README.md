# Aftergraph Compose mobile

Compose is the mobile capture surface for turning rough thoughts into agent-ready instructions. The mobile app never carries model-provider credentials and does not directly execute agent actions in v0.1.

## Run the app

```bash
cd platforms/expo
npm install
```

Set only the reachable Studio API URL in the Expo environment:

```text
EXPO_PUBLIC_AFTERGRAPH_API_URL=http://<studio-host>:8000
```
Then start Expo:

```bash
npx expo start
```

## Backend contract

Studio owns the public mobile API. Its intent provider talks only to the isolated local Hermes Compose service on loopback. Backend configuration uses:

- `AFTERGRAPH_INTENT_HERMES_URL`
- `AFTERGRAPH_INTENT_HERMES_AUTH`
- `AFTERGRAPH_INTENT_HERMES_MODEL`
- `AFTERGRAPH_INTENT_HERMES_TIMEOUT_MS`

The credential value is managed outside git and must never be exposed through an `EXPO_PUBLIC_*` variable.
## Product boundary

Compose v0.1 compiles, refines, copies, shares and stores recent instructions. It does not directly invoke Runtime, GitHub, Trust Gateway or other consequential write surfaces.

## Verification

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

A successful build does not replace a physical-device check; the final gate is the real iPhone flow against a reachable Studio API.
