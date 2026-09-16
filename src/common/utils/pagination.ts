import { z } from 'zod';
import '../../openapi/registry.js'; // extends zod with .openapi()

/**
 * Shared list contract: ?page=1&pageSize=20&sort=1 in,
 * { isError, body: { data, meta } } out.
 * Modules add their own filters and sort keys on top of paginationQuery.
 */
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
  /** 0 = id ascending (oldest first), 1 = id descending (newest first). */
  sort: z.coerce.number().int().min(0).max(1).default(1),
});

export type Pagination = z.infer<typeof paginationQuery>;

export function toLimitOffset(p: Pagination): {
  limit: number;
  offset: number;
} {
  return { limit: p.pageSize, offset: (p.page - 1) * p.pageSize };
}

/** Sequelize `order` for the shared sort flag. */
export function toOrder(p: Pagination): [string, 'ASC' | 'DESC'][] {
  return [['id', p.sort === 0 ? 'ASC' : 'DESC']];
}

export type PageMeta = { page: number; pageSize: number; total: number };

export function pageMeta(p: Pagination, total: number): PageMeta {
  return { page: p.page, pageSize: p.pageSize, total };
}

export const pageMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .openapi('PageMeta');
