import "server-only";

import { timingSafeEqual, scrypt as nodeScrypt } from "node:crypto";

import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

const KEY_LENGTH = 64;

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  if (derivedKey.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
