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
        email: string;
        name: string;
        googleId: string;
        avatar: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static generateTokens(userId: string): {
        accessToken: string;
        refreshToken: string;
    };
    static saveSession(userId: string, refreshToken: string): Promise<void>;
}
//# sourceMappingURL=authService.d.ts.map