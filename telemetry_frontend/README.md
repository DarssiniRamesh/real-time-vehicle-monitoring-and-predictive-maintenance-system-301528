# Lightweight React Template for KAVIA

This project provides a minimal React template with a clean, modern UI and minimal dependencies.

## Features

- **Lightweight**: No heavy UI frameworks - uses only vanilla CSS and React
- **Modern UI**: Clean, responsive design with KAVIA brand styling
- **Fast**: Minimal dependencies for quick loading times
- **Simple**: Easy to understand and modify

## Getting Started

In the project directory, you can run:

## Backend API contract + CORS (verified)

This frontend expects the FastAPI backend described by `interfaces/telemetry_backend_openapi.json` and calls the following endpoints:

- `GET /api/v1/health` (connectivity check)
- `GET /api/v1/assets` → returns `AssetListItem[]`
- `GET /api/v1/telemetry?assetId=<id>&from=<iso>&to=<iso>&agg=<enum>&interval=<seconds>` → returns `TelemetryQueryResponse`
  - `assetId`, `from`, `to` are required by the backend contract
  - `interval` is required when `agg != "none"`
- `POST /api/v1/predict` body: `{ asset_id?: string, timestamp?: string, readings?: object }` → returns `PredictionResult`
- `GET /api/v1/model` → returns `ModelMetadata`
- `GET /api/v1/alerts` supports filters: `assetId`, `severity`, `acknowledged`, `from`, `to`, `sort`, `offset`, `limit`, `page` → returns `{ total, items }`
- `POST /api/v1/alerts/ack` body: `{ ids: string[], acked_by?: string, ack_comment?: string }` → returns `{ updated, not_found }`

### CORS requirement

For local dev, the backend must allow cross-origin requests from:
- `http://localhost:3000` (frontend)
to:
- `http://localhost:3001` (backend)

If CORS is not configured correctly on the backend, the browser will block requests even if the API is reachable.

### API base URL env resolution

The API base URL is resolved in `src/config/env.js` using the first defined value (highest priority first):

1. `REACT_APP_API_BASE_URL`
2. `REACT_APP_API_BASE`
3. `REACT_APP_BACKEND_URL`

If none are set, it falls back to same-origin (`""`), which is only correct when the frontend is reverse-proxied behind the backend.

See `.env.example` for a working configuration.

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Customization

### Colors

The main brand colors are defined as CSS variables in `src/App.css`:

```css
:root {
  --kavia-orange: #E87A41;
  --kavia-dark: #1A1A1A;
  --text-color: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
}
```

### Components

This template uses pure HTML/CSS components instead of a UI framework. You can find component styles in `src/App.css`. 

Common components include:
- Buttons (`.btn`, `.btn-large`)
- Container (`.container`)
- Navigation (`.navbar`)
- Typography (`.title`, `.subtitle`, `.description`)

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
