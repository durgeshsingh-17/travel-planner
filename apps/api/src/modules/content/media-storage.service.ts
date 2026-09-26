import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';

import { configureMediaBaseUrl } from './shared/media-url';
import { probeImage } from '../../common/utils/image-probe.util';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface StoredFile {
  storageKey: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

/**
 * Local-disk storage for uploaded images, served by the API under /uploads.
 * Swap for an object store (S3/R2) behind the same interface in production.
 */
@Injectable()
export class MediaStorageService {
  readonly directory: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.directory = resolve(config.get<string>('media.storageDir') ?? 'uploads');
    this.publicBaseUrl = (config.get<string>('media.publicBaseUrl') ?? '/uploads').replace(/\/$/, '');
    configureMediaBaseUrl(this.publicBaseUrl);
  }

  async save(buffer: Buffer): Promise<StoredFile> {
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Images must be 10 MB or smaller');
    }

    const image = probeImage(buffer);

    if (!image) {
      throw new BadRequestException('Upload a JPEG, PNG, WebP or AVIF image');
    }

    const now = new Date();
    const storageKey = [
      'media',
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${image.extension}`
    ].join('/');
    const path = this.pathFor(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer, { flag: 'wx' });

    return {
      storageKey,
      url: `${this.publicBaseUrl}/${storageKey}`,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      bytes: buffer.length
    };
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  private pathFor(storageKey: string): string {
    const path = resolve(join(this.directory, storageKey));

    if (!path.startsWith(`${this.directory}/`)) {
      throw new BadRequestException('Invalid storage key');
    }

    return path;
  }
}
