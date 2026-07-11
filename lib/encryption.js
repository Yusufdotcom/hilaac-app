const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from ENCRYPTION_SECRET_KEY. Accepts either a raw
 * 32-byte hex string (64 hex chars) or an arbitrary passphrase (hashed with
 * sha256 to always produce a valid 256-bit key).
 */
function getKey() {
  const secret = process.env.ENCRYPTION_SECRET_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET_KEY is not set");
  }
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts plaintext (e.g. a merchant API key) into a single string:
 * base64(iv):base64(authTag):base64(ciphertext)
 * Never log the input or the output of this function.
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Decrypts a string produced by encrypt(). Returns null for empty input.
 * Only ever call this inside trusted server code, right before using the
 * secret in memory — never return the decrypted value to a client.
 */
function decrypt(payload) {
  if (payload == null || payload === "") return null;
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted payload");
  }

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

module.exports = { encrypt, decrypt };
