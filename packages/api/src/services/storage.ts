import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

/**
 * Storage interface - pluggable for local or cloud storage
 */
export interface StorageProvider {
  /**
   * Store a file and return the storage key
   */
  put(key: string, data: Buffer, contentType: string): Promise<string>;

  /**
   * Retrieve a file by key
   */
  get(key: string): Promise<Buffer>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<void>;

  /**
   * Get a signed URL for download (only for cloud providers)
   */
  getSignedUrl?(key: string, expiresIn: number): Promise<string>;
}

/**
 * Local filesystem storage provider
 */
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  }

  private getFullPath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitized = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.basePath, sanitized);
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<string> {
    const fullPath = this.getFullPath(key);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, data);

    return key;
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return readFile(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    try {
      await unlink(fullPath);
    } catch (err) {
      // Ignore if file doesn't exist
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

/**
 * S3 storage provider (stub - can be implemented when needed)
 */
export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || '';
    this.region = process.env.AWS_REGION || 'us-east-1';

    if (!this.bucket) {
      throw new Error('S3_BUCKET environment variable is required for S3 storage');
    }
  }

  async put(_key: string, _data: Buffer, _contentType: string): Promise<string> {
    // Implementation would use @aws-sdk/client-s3
    // For now, throw not implemented
    throw new Error('S3 storage not yet implemented');
  }

  async get(_key: string): Promise<Buffer> {
    throw new Error('S3 storage not yet implemented');
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error('S3 storage not yet implemented');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('S3 storage not yet implemented');
  }

  async getSignedUrl(_key: string, _expiresIn: number): Promise<string> {
    throw new Error('S3 storage not yet implemented');
  }
}

/**
 * Get the configured storage provider
 */
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  switch (provider) {
    case 's3':
      return new S3StorageProvider();
    case 'local':
    default:
      return new LocalStorageProvider();
  }
}

// Default export for convenience
export const storage = getStorageProvider();
