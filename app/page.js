import { convertImagesAction } from './server-actions';
import UploadForm from '../components/upload-form';

export const runtime = 'nodejs';

const formatOptions = [
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Photo Compressor</p>
        <h1>Compress and convert images for your website</h1>
        <p className="hero-copy">
          Upload one image or a batch, choose the target format, and cap the width or longest edge.
          We&apos;ll compress the images and provide direct download links.
        </p>
      </section>

      <UploadForm action={convertImagesAction} formatOptions={formatOptions} />
    </main>
  );
}