import type { AppRuntimeEnvironment, SafeDatabaseUrlInfo } from '@/lib/database-url-info';

export type AuthProviderAvailability = {
  credentials: boolean;
  guest: boolean;
  google: boolean;
  phone: boolean;
};

export type DemoAuthReadiness = {
  runtime: AppRuntimeEnvironment;
  database: {
    hasDatabaseUrl: boolean;
    connection: 'ok' | 'error' | 'missing';
    prismaErrorCode: string | null;
    prismaErrorName: string | null;
    prismaErrorMessageSafe: string | null;
    runtime: AppRuntimeEnvironment;
    nodeEnv: string;
    dbUrlInfo: SafeDatabaseUrlInfo;
    userTableReachable: boolean;
    guestSessionTableReachable: boolean;
  };
  auth: {
    hasNextAuthUrl: boolean;
    nextAuthUrlMatchesDeployment: boolean;
    hasNextAuthSecret: boolean;
    hasAuthSecret: boolean;
    hasAnyAuthSecret: boolean;
    adminEmailsConfigured: boolean;
    adminUserExists: boolean;
    adminUserEmail: string;
    adminHasPasswordHash: boolean;
    adminPasswordFieldUsed: 'password';
    adminAccessConfigured: boolean;
    googleConfigured: boolean;
    firebaseClientConfigured: boolean;
    firebaseAdminConfigured: boolean;
    providers: AuthProviderAvailability;
  };
  guest: {
    guestRoute: string;
    guestSessionModelReachable: boolean;
    cookieName: string;
    cookieOptions: {
      path: '/';
      sameSite: 'lax';
      httpOnly: true;
      secureInProduction: true;
      maxAgeSeconds: number;
    };
  };
  warnings: string[];
};
