import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { config } from '../config/index.js';

// Adds .openapi() to every Zod schema. This module MUST be imported
// before any schema definitions — importing `registry` guarantees that.
extendZodWithOpenApi(z);

// Modules register routes + schemas here: one Zod schema = validation +
// inferred TS types + OpenAPI docs.
export const registry = new OpenAPIRegistry();

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: config.appName,
      version: '1.0.0',
      description: 'Generated from Zod schemas — always in sync with the code.',
    },
    servers: [{ url: '/' }],
  });
}
