import type { RequestHandler } from 'express';
import multer from 'multer';
import { config } from '../../config/index.js';
import { AppError } from '../errors/app-error.js';

/**
 * Multipart upload middleware: one file in memory, size- and type-limited.
 * The buffer is handed to storage.put() by the service; nothing touches disk.
 *
 *   router.post('/:id/versions', authorize(...), upload('file'), validate(...), handler)
 *   // handler: req.file!.buffer, req.file!.mimetype, req.file!.originalname
 */

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

export function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

export function upload(
  fieldName: string,
  allowedMimeTypes: readonly string[] = DOCUMENT_MIME_TYPES,
): RequestHandler {
  const single = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.storage.uploadMaxBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(
        AppError.unsupportedMediaType(
          `Unsupported file type ${file.mimetype}; allowed: ${allowedMimeTypes.join(', ')}`,
        ),
      );
    },
  }).single(fieldName);

  return (req, res, next) => {
    single(req, res, (err: unknown) => {
      if (!err) {
        if (!req.file) {
          next(AppError.badRequest(`Missing file field "${fieldName}"`));
          return;
        }
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(
            AppError.payloadTooLarge(
              `File exceeds ${String(config.storage.uploadMaxBytes)} bytes`,
            ),
          );
          return;
        }
        next(AppError.badRequest(err.message));
        return;
      }
      next(err);
    });
  };
}
