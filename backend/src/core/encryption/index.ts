import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption secret from environment
 */
function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
  }
  return secret;
}

/**
 * Derives a key from the encryption secret using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    getEncryptionSecret(),
    salt,
    100000,
    32,
    'sha256'
  );
}

/**
 * Encrypts data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @returns Base64-encoded encrypted data with format: salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  // Generate salt for key derivation
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the data
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine salt:iv:authTag:encrypted and encode as base64
  const result = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return result.toString('base64');
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  // Decode the base64 data
  const buffer = Buffer.from(encryptedData, 'base64');

  // Extract components
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from salt
  const key = deriveKey(salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the data
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Encrypts a JSON object
 * @param data - The object to encrypt
 * @returns Base64-encoded encrypted data
 */
export function encryptJson<T>(data: T): string {
  const json = JSON.stringify(data);
  return encrypt(json);
}

/**
 * Decrypts and parses a JSON object
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Parsed object
 */
export function decryptJson<T>(encryptedData: string): T {
  const json = decrypt(encryptedData);
  return JSON.parse(json);
}

/**
 * Generates a cryptographically secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes data using SHA-256
 * @param data - The data to hash
 * @returns Hex-encoded hash
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
