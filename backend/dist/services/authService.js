"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
class AuthService {
    static async verifyGoogleToken(token) {
        try {
            if (!process.env.GOOGLE_CLIENT_ID) {
                throw new Error('Google Client ID not configured');
            }
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error('Invalid token payload');
            }
            return {
                sub: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            };
        }
        catch (error) {
            console.error('Google token verification failed:', error);
            throw new Error('Invalid Google token');
        }
    }
    static async createOrUpdateUser(googleData) {
        const { sub: googleId, email, name, picture } = googleData;
        try {
            let user = await prisma.user.findUnique({
                where: { googleId }
            });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        googleId,
                        email,
                        name,
                        avatar: picture || null
                    }
                });
                console.log('✅ New user created:', user.email);
            }
            else {
                user = await prisma.user.update({
                    where: { googleId },
                    data: {
                        email,
                        name,
                        avatar: picture || null,
                        updatedAt: new Date()
                    }
                });
                console.log('✅ User updated:', user.email);
            }
            return user;
        }
        catch (error) {
            console.error('Database operation failed:', error);
            throw new Error('Failed to create or update user');
        }
    }
    static generateTokens(userId) {
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error('JWT secrets not configured');
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
        return { accessToken, refreshToken };
    }
    static async saveSession(userId, refreshToken) {
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            await prisma.session.create({
                data: {
                    userId,
                    token: refreshToken,
                    expiresAt
                }
            });
            console.log('✅ Session saved for user:', userId);
        }
        catch (error) {
            console.error('Failed to save session:', error);
            throw new Error('Failed to save session');
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map