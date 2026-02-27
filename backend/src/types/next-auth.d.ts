import 'next-auth';

declare module 'next-auth' {
    interface User {
        id?: string;
        plan?: string;
        leadsUsed?: number;
        leadsLimit?: number;
        companyName?: string | null;
    }

    interface Session {
        user: {
            id?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            plan?: string;
            leadsUsed?: number;
            leadsLimit?: number;
            companyName?: string | null;
            /** Papel no painel admin/suporte: admin (tudo) ou support (só suporte). */
            role?: 'admin' | 'support' | null;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id?: string;
        email?: string | null;
        name?: string | null;
        picture?: string | null;
        role?: 'admin' | 'support' | null;
        plan?: string;
        leadsUsed?: number;
        leadsLimit?: number;
        companyName?: string | null;
    }
}
