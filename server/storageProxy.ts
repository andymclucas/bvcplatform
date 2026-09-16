import type { Express } from "express";
import { ENV } from "../_core/env";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function registerStorageProxy(app: Express) {
  app.get("/r2-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: ENV.r2AccessKeyId,
          secretAccessKey: ENV.r2SecretAccessKey,
        },
      });

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: ENV.r2BucketName, Key: key }),
        { expiresIn: 3600 },
      );

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });

  // Also handle legacy /manus-storage/* paths
  app.get("/manus-storage/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    res.redirect(301, `/r2-storage/${key}`);
  });
}
