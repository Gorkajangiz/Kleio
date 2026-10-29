import {
  decryptText,
  encryptText,
  fromBase64,
  generateMasterKey,
  importMasterKey,
  toBase64,
  unwrapMasterKey,
  wrapMasterKey,
} from './crypto';

describe('crypto utils', () => {
  it('wraps and unwraps a master key with a PIN', async () => {
    const key = await generateMasterKey();
    const raw = await crypto.subtle.exportKey('raw', key);

    const wrapped = await wrapMasterKey(raw, '1234');
    const unwrapped = await unwrapMasterKey(wrapped, '1234');

    expect(Array.from(new Uint8Array(unwrapped))).toEqual(
      Array.from(new Uint8Array(raw))
    );
  }, 30_000);

  it('rejects an incorrect PIN', async () => {
    const key = await generateMasterKey();
    const raw = await crypto.subtle.exportKey('raw', key);
    const wrapped = await wrapMasterKey(raw, '1234');

    await expect(unwrapMasterKey(wrapped, '9999')).rejects.toMatchObject({
      code: 'INVALID_SECRET',
    });
  }, 30_000);

  it('round-trips encrypted entry text', async () => {
    const key = await generateMasterKey();
    const raw = await crypto.subtle.exportKey('raw', key);
    const imported = await importMasterKey(raw);

    const encrypted = await encryptText(imported, 'Hoy fue un buen día');
    const decrypted = await decryptText(imported, encrypted);

    expect(encrypted).not.toContain('Hoy fue un buen día');
    expect(decrypted).toBe('Hoy fue un buen día');
  });

  it('round-trips base64 bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);

    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
