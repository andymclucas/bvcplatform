// Cloudflare R2 storage helpers (S3-compatible API)
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { Readable } from "node:stream";

function getS3Client(): S3Client {
  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
    throw new Error(
      "R2 storage config missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function keyToUrl(key: string): string {
  if (ENV.r2PublicUrl) {
    return `${ENV.r2PublicUrl.replace(/\/+$/, "")}/${key}`;
  }
  return `/r2-storage/${key}`;
}

/** Prepare a one-time presigned URL for a browser to upload directly to R2. */
export async function storagePrepareUpload(relKey: string): Promise<{
  key: string;
  url: string;
  uploadUrl: string;
}> {
  const s3 = getS3Client();
  const key = appendHashSuffix(normalizeKey(relKey));

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: ENV.r2BucketName, Key: key }),
    { expiresIn: 3600 },
  );

  return { key, url: keyToUrl(key), uploadUrl };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const s3 = getS3Client();
  const key = appendHashSuffix(normalizeKey(relKey));

  const body =
    typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data as Uint8Array);

  await s3.send(
    new PutObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: keyToUrl(key) };
}

export async function storagePutStream(
  relKey: string,
  data: Readable,
  contentType = "application/octet-stream",
  _contentLength?: number,
): Promise<{ key: string; url: string }> {
  // Buffer the stream then upload (R2 doesn't support streaming PUT without Content-Length)
  const chunks: Buffer[] = [];
  for await (const chunk of data) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const body = Buffer.concat(chunks);

  const s3 = getS3Client();
  const key = appendHashSuffix(normalizeKey(relKey));

  await s3.send(
    new PutObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: keyToUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: keyToUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const s3 = getS3Client();
  const key = normalizeKey(relKey);

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: ENV.r2BucketName, Key: key }),
    { expiresIn: 3600 },
  );
}
