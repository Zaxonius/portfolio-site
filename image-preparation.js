// The original stays in the browser. Only this resized JPEG is uploaded.
export async function compressImage(file, { decode = createImageBitmap, makeCanvas = () => document.createElement('canvas') } = {}) {
  const image = await decode(file);
  try {
    const canvas = makeCanvas();
    const context = canvas.getContext('2d');
    if (!context || !image.width || !image.height) throw new Error('Could not read this image.');
    let edge = Math.min(1000, Math.max(image.width, image.height));
    while (edge >= 1) {
      const scale = Math.min(1, edge / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.8, .7, .6, .5]) {
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not compress this image.')), 'image/jpeg', quality));
        if (blob.size <= 200 * 1024) return blob;
      }
      if (edge <= 256) break;
      edge = Math.max(256, Math.floor(edge * .8));
    }
    throw new Error('Could not compress this image to a small enough size.');
  } finally { image.close(); }
}
