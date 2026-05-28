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
- Download links and previews for processed files

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

- Generated images are written to a temporary directory (`/tmp` on Vercel).
- Downloads are served through API routes.
- Files are short-lived and cleaned up automatically.
