import { createHash } from 'crypto';

export type AppRuntimeEnvironment = 'vercel' | 'local';

export type SafeDatabaseUrlInfo = {
  protocol: string | null;
  host: string | null;
  databaseName: string | null;
  hasSslModeRequire: boolean;
  isPoolerHost: boolean;
  length: number;
  fingerprint: string | null;
};

function createFingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function getAppRuntimeEnvironment(): AppRuntimeEnvironment {
  return process.env.VERCEL ? 'vercel' : 'local';
}

export function getSafeDatabaseUrlInfo(databaseUrl = process.env.DATABASE_URL): SafeDatabaseUrlInfo {
  const trimmed = databaseUrl?.trim() ?? '';
  const fallbackInfo: SafeDatabaseUrlInfo = {
    protocol: null,
    host: null,
    databaseName: null,
    hasSslModeRequire: /(?:\?|&)sslmode=require(?:&|$)/i.test(trimmed),
    isPoolerHost: false,
    length: trimmed.length,
    fingerprint: trimmed ? createFingerprint(trimmed) : null,
  };

  if (!trimmed) {
    return fallbackInfo;
  }

  try {
    const parsed = new URL(trimmed);
    const databaseName = parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;

    return {
      protocol: parsed.protocol || null,
      host: parsed.hostname || null,
      databaseName: databaseName ? decodeURIComponent(databaseName) : null,
      hasSslModeRequire: parsed.searchParams.get('sslmode') === 'require',
      isPoolerHost: parsed.hostname.includes('-pooler.'),
      length: trimmed.length,
      fingerprint: createFingerprint(trimmed),
    };
  } catch {
    const protocolMatch = trimmed.match(/^([a-z0-9+.-]+:)/i);
    const hostMatch = trimmed.match(/^[a-z0-9+.-]+:\/\/(?:[^@\/\s]+@)?([^\/\s?#:]+)/i);
    const databaseMatch = trimmed.match(/^[a-z0-9+.-]+:\/\/(?:[^@\/\s]+@)?[^\/\s?#]+\/([^?\s#]+)/i);

    return {
      ...fallbackInfo,
      protocol: protocolMatch?.[1] ?? null,
      host: hostMatch?.[1] ?? null,
      databaseName: databaseMatch?.[1] ? decodeURIComponent(databaseMatch[1]) : null,
      isPoolerHost: Boolean(hostMatch?.[1]?.includes('-pooler.')),
    };
  }
}
