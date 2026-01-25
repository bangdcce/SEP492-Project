import sharp = require('sharp');

/**
 * Watermark Utility for KYC Document Protection
 * Prevents data leaks by embedding reviewer identity into images
 */

export interface WatermarkOptions {
  reviewerEmail: string;
  reviewerRole: 'ADMIN' | 'STAFF';
  ipAddress: string;
  sessionId: string;
  timestamp: Date;
  kycId: string;
}

/**
 * Add dynamic watermark to image buffer
 * Watermark contains: Email, Timestamp, IP, Session ID
 * Purpose: If leaked, we can trace who leaked it
 */
export async function addWatermark(
  imageBuffer: Buffer,
  options: WatermarkOptions,
): Promise<Buffer> {
  const { reviewerEmail, reviewerRole, ipAddress, sessionId, timestamp, kycId } = options;

  // Create watermark text (multi-line)
  const watermarkLines = [
    `CONFIDENTIAL - DO NOT DISTRIBUTE`,
    `Viewed by: ${reviewerEmail} (${reviewerRole})`,
    `Time: ${timestamp.toISOString()}`,
    `IP: ${ipAddress}`,
    `Session: ${sessionId.substring(0, 8)}`,
    `KYC ID: ${kycId.substring(0, 8)}`,
    `© InterDev Platform - All Rights Reserved`,
  ];

  const watermarkText = watermarkLines.join('\n');

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const { width = 800, height = 600 } = metadata;

  // Calculate font size based on image size
  const fontSize = Math.max(12, Math.floor(width / 50));
  const lineHeight = fontSize * 1.5;

  // Create SVG watermark
  const svgWatermark = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Semi-transparent background overlay -->
      <rect width="${width}" height="${height}" fill="rgba(0, 0, 0, 0.02)" />
      
      <!-- Diagonal watermark (center) -->
      <text
        x="${width / 2}"
        y="${height / 2}"
        font-family="Arial, sans-serif"
        font-size="${fontSize * 2}"
        font-weight="bold"
        fill="rgba(255, 0, 0, 0.15)"
        text-anchor="middle"
        transform="rotate(-45 ${width / 2} ${height / 2})"
      >
        CONFIDENTIAL - ${reviewerEmail}
      </text>
      
      <!-- Top watermark (detailed info) -->
      <text
        x="10"
        y="20"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        fill="rgba(255, 255, 255, 0.9)"
        stroke="rgba(0, 0, 0, 0.5)"
        stroke-width="1"
      >
        ${watermarkLines.map((line, index) => `
          <tspan x="10" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>
        `).join('')}
      </text>
      
      <!-- Bottom right watermark (minimal) -->
      <text
        x="${width - 10}"
        y="${height - 20}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        fill="rgba(255, 255, 255, 0.8)"
        stroke="rgba(0, 0, 0, 0.5)"
        stroke-width="1"
        text-anchor="end"
      >
        ${reviewerEmail} - ${timestamp.toLocaleString()}
      </text>
      
      <!-- Repeating pattern watermark (anti-screenshot) -->
      ${generatePatternWatermark(width, height, reviewerEmail, fontSize)}
    </svg>
  `;

  // Apply watermark to image
  const watermarkedImage = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgWatermark),
        gravity: 'northwest',
      },
    ])
    .jpeg({ quality: 85 }) // Slightly reduce quality to make screenshot less valuable
    .toBuffer();

  return watermarkedImage;
}

/**
 * Generate repeating pattern watermark across entire image
 * Makes it harder to crop out watermark
 */
function generatePatternWatermark(
  width: number,
  height: number,
  email: string,
  fontSize: number,
): string {
  const patterns: string[] = [];
  const spacing = 200;

  for (let y = 100; y < height; y += spacing) {
    for (let x = 100; x < width; x += spacing) {
      patterns.push(`
        <text
          x="${x}"
          y="${y}"
          font-family="Arial"
          font-size="${fontSize * 0.8}"
          fill="rgba(0, 0, 0, 0.05)"
          transform="rotate(-45 ${x} ${y})"
        >
          ${email}
        </text>
      `);
    }
  }

  return patterns.join('');
}

/**
 * Create forensic watermark for high-security documents
 * Embeds invisible metadata that can be extracted later
 */
export async function addForensicWatermark(
  imageBuffer: Buffer,
  metadata: Record<string, string>,
): Promise<Buffer> {
  // Add EXIF metadata for forensics
  return sharp(imageBuffer)
    .withMetadata({
      exif: {
        IFD0: {
          Copyright: `InterDev - Viewed by ${metadata.reviewerEmail}`,
          ImageDescription: JSON.stringify(metadata),
        },
      },
    })
    .toBuffer();
}
