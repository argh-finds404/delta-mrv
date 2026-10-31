import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface UploadResult {
  url: string;
  storageKey: string;
  sizeBytes: number;
  contentType: string;
}

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  subfolder?: string;
}

/**
 * Local storage provider for zero-cost, zero-configuration local development.
 * Stores files under public/uploads and returns public URLs.
 */
class LocalStorageService {
  private baseDir = path.join(process.cwd(), "public", "uploads");

  private async ensureDir(targetPath: string) {
    await fs.mkdir(targetPath, { recursive: true });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { buffer, filename, contentType, subfolder = "evidence" } = options;
    const targetFolder = path.join(/*turbopackIgnore: true*/ this.baseDir, subfolder);
    await this.ensureDir(targetFolder);

    const ext = path.extname(filename) || ".jpg";
    const randomName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(/*turbopackIgnore: true*/ targetFolder, randomName);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${subfolder}/${randomName}`;
    const storageKey = `${subfolder}/${randomName}`;

    return {
      url: publicUrl,
      storageKey,
      sizeBytes: buffer.length,
      contentType,
    };
  }
}

export const storageService = new LocalStorageService();
