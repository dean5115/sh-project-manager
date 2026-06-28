import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const OUT_DIR = path.resolve(__dirname, '../../web/public/icons')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

function svg(size: number, padding: number) {
  const inner = size - padding * 2
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#1B4F72" rx="${size * 0.12}" />
      <text x="50%" y="${padding + inner * 0.62}" text-anchor="middle"
        font-family="Arial, sans-serif" font-weight="bold" font-size="${inner * 0.42}" fill="#F39C12">SH</text>
    </svg>
  `
}

async function run() {
  const targets: { name: string; size: number; padding: number }[] = [
    { name: 'icon-192.png', size: 192, padding: 12 },
    { name: 'icon-512.png', size: 512, padding: 32 },
    { name: 'icon-maskable-192.png', size: 192, padding: 30 },
    { name: 'icon-maskable-512.png', size: 512, padding: 80 },
    { name: 'apple-touch-icon.png', size: 180, padding: 12 },
  ]

  for (const t of targets) {
    await sharp(Buffer.from(svg(t.size, t.padding)))
      .png()
      .toFile(path.join(OUT_DIR, t.name))
    console.log(`✓ ${t.name}`)
  }
}

run()
