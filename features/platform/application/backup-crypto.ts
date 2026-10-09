import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import { badRequest } from "../domain/errors";

const MAGIC = Buffer.from("OPSLYBK1");
const SALT = 16,
  IV = 12,
  TAG = 16;
const MAX_PLAINTEXT = 200 * 1024 * 1024;

function derive(tenantId: string, salt: Buffer): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be set to at least 32 characters.",
    );
  }
  // Tenant id is part of the key, so a backup only opens for its own workspace.
  return scryptSync(`${secret}:${tenantId}`, salt, 32);
}

/** File layout: MAGIC | salt | iv | auth tag | AES-256-GCM(gzip(plaintext)). */
export function encryptBackup(plain: Buffer, tenantId: string): Buffer {
  const salt = randomBytes(SALT);
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", derive(tenantId, salt), iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(file: Buffer, tenantId: string): Buffer {
  const fail = () =>
    badRequest(
      "This backup can't be opened. It may be damaged, from another workspace, or encrypted with a different key.",
    );

  const header = MAGIC.length + SALT + IV + TAG;
  if (file.length <= header || !file.subarray(0, MAGIC.length).equals(MAGIC))
    throw fail();

  const salt = file.subarray(MAGIC.length, MAGIC.length + SALT);
  const iv = file.subarray(MAGIC.length + SALT, MAGIC.length + SALT + IV);
  const tag = file.subarray(MAGIC.length + SALT + IV, header);
  const body = file.subarray(header);

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      derive(tenantId, salt),
      iv,
    );
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    const gz = Buffer.concat([decipher.update(body), decipher.final()]);
    return gunzipSync(gz, { maxOutputLength: MAX_PLAINTEXT });
  } catch {
    throw fail();
  }
}
