const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ============================================
// CONFIGURATION: Put your image paths here
// ============================================
const MY_IMAGE_PATHS = [
  './jepgs/georgesList2.png',
  './jepgs/georgesListLogo.png',

];

// Optional: Set desired output width (in pixels). Leave as null to keep original size.
const OUTPUT_WIDTH = null; // Example: 1920, 1280, 800, etc.
const OUTPUT_DIR = './desktop';
// ============================================

/**
 * Converts an array of images to WebP format
 * @param {string[]} imagePaths - Array of file paths to images
 * @param {Object} options - Optional configuration
 * @param {number} options.quality - WebP quality (1-100), default: 75
 * @param {string} options.outputDir - Output directory, default: './desktop'
 * @param {number|null} options.width - Output width in pixels (maintains aspect ratio), default: null (original size)
 * @returns {Promise<Array>} Array of converted file paths
 */
async function convertToWebP(imagePaths, options = {}) {
// change output directory to ./mobile or ./desktop depending on the width
  const { quality = 75, outputDir = null, width = null } = options;
  const results = [];
  const errors = [];

  // Create output directory if specified
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process each image
  for (const imagePath of imagePaths) {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`File not found: ${imagePath}`);
      }

      // Generate output path
      const ext = path.extname(imagePath);
      const baseName = path.basename(imagePath, ext);
      const dir = outputDir || path.dirname(imagePath);
      const outputPath = path.join(dir, `${baseName}.webp`);

      // Create Sharp instance
      let sharpInstance = sharp(imagePath);

      // Resize if width is specified (maintains aspect ratio automatically)
      if (width && width > 0) {
        sharpInstance = sharpInstance.resize({ width, withoutEnlargement: true });
      }

      // Convert to WebP
      await sharpInstance
        .webp({ quality })
        .toFile(outputPath);

      results.push(outputPath);
      const sizeInfo = width ? ` (resized to ${width}px width)` : '';
      console.log(`✓ Converted: ${imagePath} → ${outputPath}${sizeInfo}`);
    } catch (error) {
      errors.push({ imagePath, error: error.message });
      console.error(`✗ Error converting ${imagePath}:`, error.message);
    }
  }

  // Summary
  console.log(`\n--- Conversion Summary ---`);
  console.log(`Successfully converted: ${results.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(({ imagePath, error }) => {
      console.log(`  - ${imagePath}: ${error}`);
    });
  }

  return results;
}

// Example usage
if (require.main === module) {
  // Get image paths from command line arguments OR use the configured array above
  const imagePaths = process.argv.slice(2).length > 0 ? process.argv.slice(2) : MY_IMAGE_PATHS;

  if (imagePaths.length === 0) {
    console.log('Usage: node index.js <image1> <image2> ... <imageN>');
    console.log('\nOr configure MY_IMAGE_PATHS array at the top of index.js');
    console.log('\nExample command line:');
    console.log('  node index.js ./images/photo1.jpg ./images/photo2.png');
    process.exit(1);
  }

  convertToWebP(imagePaths, { 
    quality: 75,
    outputDir: OUTPUT_DIR || './convertted',
    width: OUTPUT_WIDTH || null
  })
    .then(() => {
      console.log('\n✓ All conversions completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Fatal error:', error);
      process.exit(1);
    });
}

// Export the function for use in other modules
module.exports = { convertToWebP };

