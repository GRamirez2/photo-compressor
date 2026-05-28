import { Space_Grotesk, Fraunces } from 'next/font/google';
import Image from 'next/image';
import './globals.css';

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
});

const bodyFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Photo Compressor',
  description: 'Upload images, convert formats, and resize them with a React Server Component workflow.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        {children}
        <footer className="site-signature" aria-label="Site signature">
          <a
            className="site-signature-link"
            href="https://sparrowstudios.tech"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/sparrowstudio-logo.webp"
              alt="Sparrow Studios logo"
              width={100}
              height={100}
              className="site-signature-logo"
            />
            <span className="site-signature-text">Sparrow Studios</span>
          </a>
        </footer>
      </body>
    </html>
  );
}