'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRGenerator({ url }: { url: string }) {
  const [svgData, setSvgData] = useState('');

  useEffect(() => {
    QRCode.toString(url, {
      type: 'svg',
      width: 400,
      margin: 2,
      color: { dark: '#5B6B52', light: '#FAF8F5' },
    }).then(setSvgData);
  }, [url]);

  function handleDownload() {
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'regards-qr-code.svg';
    link.click();
  }

  return (
    <div className="text-center">
      <div dangerouslySetInnerHTML={{ __html: svgData }} className="mx-auto w-48" />
      <p className="mt-2 text-sm text-text-secondary">{url}</p>
      <button onClick={handleDownload} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-white">
        Télécharger le QR code (SVG)
      </button>
    </div>
  );
}