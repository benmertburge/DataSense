import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  private getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'fallback-key-for-development';
    return crypto.scryptSync(secret, 'salt', this.keyLength);
  }

  async encrypt(text: string): Promise<string> {
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.getKey();
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from('compensation-data'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Combine iv + tag + encrypted data
    const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  }

  async decrypt(encryptedData: string): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');
    const iv = combined.slice(0, this.ivLength);
    const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = combined.slice(this.ivLength + this.tagLength);

    const key = this.getKey();
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAAD(Buffer.from('compensation-data'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async hash(data: string): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
