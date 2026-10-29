export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

export type CryptoErrorCode =
  | 'INVALID_SECRET'
  | 'PIN_NOT_CONFIGURED'
  | 'RECOVERY_NOT_FOUND'
  | 'KEY_NOT_UNLOCKED';

export class CryptoError extends Error {
  constructor(
    readonly code: CryptoErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

export interface WrappedKey {
  salt: string;
  iv: string;
  wrappedKey: string;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function importMasterKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function deriveWrappingKey(
  secret: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function wrapMasterKey(
  rawMasterKey: ArrayBuffer,
  secret: string
): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrappingKey = await deriveWrappingKey(secret, salt);

  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    wrappingKey,
    rawMasterKey
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    wrappedKey: toBase64(new Uint8Array(wrapped)),
  };
}

export async function unwrapMasterKey(
  wrapped: WrappedKey,
  secret: string
): Promise<ArrayBuffer> {
  const salt = fromBase64(wrapped.salt);
  const iv = fromBase64(wrapped.iv);
  const ciphertext = fromBase64(wrapped.wrappedKey);
  const wrappingKey = await deriveWrappingKey(secret, salt);

  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      wrappingKey,
      toArrayBuffer(ciphertext)
    );
  } catch {
    throw new CryptoError(
      'INVALID_SECRET',
      'El PIN o la contraseña no son correctos.'
    );
  }
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);

  return toBase64(result);
}

export async function decryptText(
  key: CryptoKey,
  encryptedText: string
): Promise<string> {
  const data = fromBase64(encryptedText);
  const iv = data.slice(0, IV_BYTES);
  const ciphertext = data.slice(IV_BYTES);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export function toBase64(array: Uint8Array): string {
  let binary = '';
  array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(array: Uint8Array): ArrayBuffer {
  return array.buffer.slice(
    array.byteOffset,
    array.byteOffset + array.byteLength
  ) as ArrayBuffer;
}
