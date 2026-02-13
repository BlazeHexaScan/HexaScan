#!/usr/bin/env node

/**
 * Generate secure random secrets for environment variables
 */

import crypto from 'crypto';

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('='.repeat(60));
console.log('Generated Secrets for .env file');
console.log('='.repeat(60));
console.log('');
console.log('Copy these values to your .env file:');
console.log('');
console.log(`JWT_SECRET=${generateSecret(32)}`);
console.log(`JWT_REFRESH_SECRET=${generateSecret(32)}`);
console.log(`ENCRYPTION_SECRET=${generateSecret(32)}`);
console.log('');
console.log('='.repeat(60));
console.log('IMPORTANT: Keep these secrets secure and never commit them!');
console.log('='.repeat(60));
