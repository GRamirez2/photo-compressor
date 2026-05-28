# photo-compressor

Next.js app that converts and resizes uploaded images with Sharp using React Server Components and a server action.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000` and upload one or more images.

## Features

- Batch upload support
- Output formats: WebP, JPEG, PNG
- Resize by max width or max longest edge
- Server-side processing with Sharp
- Direct-to-Blob uploads to bypass server action request size limits
- Processed image downloads served from Vercel Blob URLs

## Build

```bash
npm run build
npm start
```

## Deploy to Vercel

This project is ready for Vercel with the default Next.js settings.

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Keep Framework Preset as Next.js.
4. Deploy.

### Runtime storage behavior

- Source uploads are sent directly from the browser to Vercel Blob using `@vercel/blob/client`.
- Converted outputs are written to Vercel Blob on the server with `@vercel/blob`.
- The app returns Blob URLs for individual downloads and builds ZIP downloads client-side.

### Required environment variables

- `BLOB_READ_WRITE_TOKEN`

### How to get `BLOB_READ_WRITE_TOKEN`

1. Open your project in the Vercel dashboard.
2. Go to **Storage** and create or connect a Blob store.
3. Open the Blob store details and copy the **Read/Write token**.
4. Add it to your project environment variables as `BLOB_READ_WRITE_TOKEN`.
5. Pull the env vars locally:

```bash
vercel env pull .env.local --yes
```

For local development, `.env.local` should contain:

```bash
BLOB_READ_WRITE_TOKEN=your_read_write_token_here
```

### Store ID and Base URL notes

- The Blob **Store ID is not the token**. Do not put the store ID in `BLOB_READ_WRITE_TOKEN`.
- The Blob **Base URL is also not required** for this app's current SDK-based flow.
- This app only requires `BLOB_READ_WRITE_TOKEN` for server-side Blob operations and upload token generation.
