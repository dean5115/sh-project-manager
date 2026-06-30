import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// .trim() guards against stray whitespace/newlines from copy-pasting credentials into a dashboard env var field —
// an untrimmed secret key breaks the SDK's request signing with a cryptic "Invalid character in header" error.
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim()
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim()
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim()
const R2_BUCKET = process.env.R2_BUCKET?.trim()
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, '') // e.g. https://pub-xxxx.r2.dev or a custom domain, no trailing slash

const useR2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL)

const s3 = useR2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
    })
  : null

export function isUsingR2() {
  return useR2
}

// Accepts either a relative local path (/uploads/foo.jpg) or a full R2 URL — both resolve to the stored object's key/filename.
function keyOf(urlOrKey: string): string {
  return path.basename(urlOrKey)
}

export async function saveFile(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
  if (useR2 && s3) {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    }))
    return `${R2_PUBLIC_URL}/${filename}`
  }

  const uploadDir = path.resolve(UPLOAD_DIR)
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
  fs.writeFileSync(path.join(uploadDir, filename), buffer)
  return `/uploads/${filename}`
}

export async function readFile(urlOrKey: string): Promise<Buffer | null> {
  const key = keyOf(urlOrKey)

  if (useR2 && s3) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      const chunks: Buffer[] = []
      for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk))
      return Buffer.concat(chunks)
    } catch {
      return null
    }
  }

  const filePath = path.join(path.resolve(UPLOAD_DIR), key)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath)
}

export async function deleteFile(urlOrKey: string): Promise<void> {
  const key = keyOf(urlOrKey)

  if (useR2 && s3) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    } catch {
      // already gone — fine
    }
    return
  }

  const filePath = path.join(path.resolve(UPLOAD_DIR), key)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
