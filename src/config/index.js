import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Laravel Forge: PM2 `cwd` is often `.../releases/<id>` while `.env` lives in the site root.
 * Default `dotenv/config` only reads `cwd/.env`, so secrets were missing and the process exited.
 */
const cwd = process.cwd();
for (const rel of ['.env', path.join('..', '.env'), path.join('..', '..', '.env')]) {
  const abs = path.resolve(cwd, rel);
  if (fs.existsSync(abs)) {
    dotenv.config({ path: abs, quiet: true });
    break;
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  PUBLIC_BASE_URL: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || /^https?:\/\/.+/i.test(v), {
      message: 'PUBLIC_BASE_URL must be a valid http(s) URL',
    })
    .transform((v) => (v === '' ? undefined : v)),
  TENANT_SLUGS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten());
  throw new Error('Environment validation failed');
}

const { PORT, NODE_ENV, JWT_SECRET, PUBLIC_BASE_URL, TENANT_SLUGS } = parsed.data;

/**
 * Application configuration loaded from environment variables (validated with Zod).
 * TODO: Replace direct env access with Azure Key Vault references for production secrets.
 * @type {{
 *   port: number;
 *   nodeEnv: string;
 *   jwtSecret: string;
 *   publicBaseUrl: string | undefined;
 *   tenantSlugs: string[] | undefined;
 * }}
 */
export const config = {
  port: PORT,
  nodeEnv: NODE_ENV,
  jwtSecret: JWT_SECRET,
  publicBaseUrl: PUBLIC_BASE_URL,
  tenantSlugs: TENANT_SLUGS
    ? TENANT_SLUGS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined,
};
