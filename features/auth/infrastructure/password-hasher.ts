import "server-only";

import { randomBytes, scrypt as nodeScrypt } from "node:crypto";

import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return ["scrypt", salt, derivedKey.toString("hex")].join("$");
}
