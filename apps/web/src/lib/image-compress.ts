const MAX_DIMENSION = 2000
const QUALITY = 0.82
// מתחת לגודל הזה אין טעם לכווץ — התמונה כבר קטנה מספיק
const MIN_BYTES_TO_COMPRESS = 600 * 1024

// מקטין תמונת פלאפון ל-JPEG של עד 2000px בצד הארוך — מספיק לדוח PDF ולזום,
// ומוריד קובץ של כמה MB לכמה מאות KB. אם משהו נכשל — מחזירים את הקובץ המקורי.
export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined') return file
  // PNG נשאר כמו שהוא — לוגואים וצילומי מסך עם רקע שקוף היו מקבלים רקע שחור בהמרה ל-JPEG
  if (!file.type.startsWith('image/') || ['image/gif', 'image/svg+xml', 'image/png'].includes(file.type)) return file
  if (file.size < MIN_BYTES_TO_COMPRESS) return file

  try {
    // imageOrientation: 'from-image' — מסובב לפי EXIF כדי שתמונות פלאפון לא ייצאו שוכבות
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name || 'photo.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
