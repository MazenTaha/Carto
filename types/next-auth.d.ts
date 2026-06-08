// Extend NextAuth types

import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string | null;
      name: string | null;
      phoneNumber?: string | null;
      image?: string | null;
      role?: 'ADMIN' | 'USER';
      provider?: string | null;
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name: string | null;
    phoneNumber?: string | null;
    image?: string | null;
    role?: 'ADMIN' | 'USER';
    provider?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email?: string | null;
    name: string | null;
    phoneNumber?: string | null;
    image?: string | null;
    role?: 'ADMIN' | 'USER';
    provider?: string | null;
  }
}

