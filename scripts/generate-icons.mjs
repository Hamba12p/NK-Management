import sharp from 'sharp'

const source = 'src/app/icon.jpeg'
const output = 'public/icons'
const background = '#f8f8f8'

await sharp(source)
  .resize(192, 192, { fit: 'contain', background })
  .png()
  .toFile(`${output}/icon-192.png`)

await sharp(source)
  .resize(512, 512, { fit: 'contain', background })
  .png()
  .toFile(`${output}/icon-512.png`)

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 3,
    background,
  },
})
  .composite([
    {
      input: await sharp(source)
        .resize(410, 410, { fit: 'contain', background })
        .png()
        .toBuffer(),
      gravity: 'center',
    },
  ])
  .flatten({ background })
  .removeAlpha()
  .png()
  .toFile(`${output}/icon-maskable-512.png`)

await sharp(source)
  .resize(180, 180, { fit: 'contain', background })
  .flatten({ background })
  .png()
  .toFile(`${output}/apple-touch-icon.png`)

console.log(`Generated PWA icons from ${source}`)
