# photo-compressor

Node app that takes photos and converts them to WebP format using Sharp.

## Installation

```bash
npm install
```

## Usage

### Command Line

Convert one or more images:

```bash
node index.js ./images/photo1.jpg ./images/photo2.png ./images/photo3.jpeg
```

### Programmatic Usage

```javascript
const { convertToWebP } = require('./index.js');

// Convert array of images
const imagePaths = [
  './images/photo1.jpg',
  './images/photo2.png',
  './images/photo3.jpeg'
];

// Basic usage
await convertToWebP(imagePaths);

// With options
await convertToWebP(imagePaths, {
  quality: 90,        // WebP quality (1-100), default: 80
  outputDir: './output'  // Optional output directory
});
```

## Features

- Converts multiple images in one operation
- Configurable WebP quality
- Optional output directory
- Error handling with detailed error messages
- Progress feedback during conversion
