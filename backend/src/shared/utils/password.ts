import bcrypt from 'bcrypt';
import { systemConfigService } from '../../core/config/index.js';

/**
 * Hashes a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = systemConfigService.get<number>('auth.bcryptSaltRounds');
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
