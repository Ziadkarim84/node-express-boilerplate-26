import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';

/**
 * File storage behind one small interface.
 * - Production: Google Cloud Storage (GCS_BUCKET, Application Default
 *   Credentials). Objects are private; readers get short-lived signed URLs.
 * - Development without GCS_BUCKET: files land in STORAGE_LOCAL_DIR and
 *   "signed URLs" are file:// paths — enough to exercise upload flows.
 *
 * Object keys are built by the caller, e.g.
 *   documents/{module}/{ownerId}/{documentTypeCode}/v{n}/{fileName}
 * so a bucket listing reads like the domain.
 */

export type StoredObject = {
  path: string; // object key — goes into document_versions.file_path
  size: number;
  checksum: string; // sha256 hex — goes into document_versions.checksum
  contentType: string;
};

export type PutObjectInput = {
  path: string;
  body: Buffer;
  contentType: string;
  /** Free-form metadata stored with the object (uploader, document id...). */
  metadata?: Record<string, string>;
};

export interface StorageDriver {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(objectPath: string): Promise<Buffer>;
  delete(objectPath: string): Promise<void>;
  /** Time-limited read URL for a private object. */
  signedReadUrl(objectPath: string, ttlSeconds?: number): Promise<string>;
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/* -------------------------------- GCS -------------------------------- */

class GcsDriver implements StorageDriver {
  private readonly bucket;

  constructor(bucketName: string, projectId?: string) {
    const storage = new Storage(projectId ? { projectId } : {});
    this.bucket = storage.bucket(bucketName);
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const checksum = sha256(input.body);
    await this.bucket.file(input.path).save(input.body, {
      contentType: input.contentType,
      resumable: false,
      metadata: { metadata: { sha256: checksum, ...input.metadata } },
    });
    return {
      path: input.path,
      size: input.body.length,
      checksum,
      contentType: input.contentType,
    };
  }

  async get(objectPath: string): Promise<Buffer> {
    const [contents] = await this.bucket.file(objectPath).download();
    return contents;
  }

  async delete(objectPath: string): Promise<void> {
    await this.bucket.file(objectPath).delete({ ignoreNotFound: true });
  }

  async signedReadUrl(
    objectPath: string,
    ttlSeconds = config.storage.signedUrlTtlSeconds,
  ): Promise<string> {
    const [url] = await this.bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });
    return url;
  }
}

/* ------------------------------ Local disk ------------------------------ */

class LocalDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(objectPath: string): string {
    const full = path.resolve(this.root, objectPath);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`Refusing to escape storage root: ${objectPath}`);
    }
    return full;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const full = this.resolve(input.path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.body);
    return {
      path: input.path,
      size: input.body.length,
      checksum: sha256(input.body),
      contentType: input.contentType,
    };
  }

  get(objectPath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(objectPath));
  }

  async delete(objectPath: string): Promise<void> {
    await fs.rm(this.resolve(objectPath), { force: true });
  }

  signedReadUrl(objectPath: string): Promise<string> {
    return Promise.resolve(`file://${this.resolve(objectPath)}`);
  }
}

/* ------------------------------- Factory ------------------------------- */

function createStorage(): StorageDriver {
  const { gcsBucket, gcsProjectId, localDir } = config.storage;
  if (gcsBucket) {
    logger.info(`Storage: GCS bucket ${gcsBucket}`);
    return new GcsDriver(gcsBucket, gcsProjectId);
  }
  logger.warn(
    `Storage: GCS_BUCKET not set, using local directory ${localDir} (dev only)`,
  );
  return new LocalDriver(localDir);
}

export const storage: StorageDriver = createStorage();
