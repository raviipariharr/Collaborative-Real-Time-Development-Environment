export interface GoogleTokenPayload {
    sub: string;
    email: string;
    name: string;
    picture?: string;
}
export declare class AuthService {
    static verifyGoogleToken(token: string): Promise<GoogleTokenPayload>;
    static createOrUpdateUser(googleData: GoogleTokenPayload): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        googleId: string;
        email: string;
        avatar: string | null;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
    static generateTokens(userId: string): {
        accessToken: string;
        refreshToken: string;
    };
    static saveSession(userId: string, refreshToken: string): Promise<void>;
}
