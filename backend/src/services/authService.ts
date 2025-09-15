// backend/src/services/authService.ts
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string | undefined; // Fix: Allow undefined
}

export class AuthService {
  static async verifyGoogleToken(token: string): Promise<GoogleTokenPayload> {
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
        email: payload.email!,
        name: payload.name!,
        picture: payload.picture // This can be undefined
      };
    } catch (error) {
      console.error('Google token verification error:', error);
      throw new Error('Invalid Google token');
    }
  }

  static async createOrUpdateUser(googleData: GoogleTokenPayload) {
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
      } else {
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
    } catch (error) {
      console.error('Database error in createOrUpdateUser:', error);
      throw new Error('Failed to create or update user');
    }
  }

  static generateTokens(userId: string) {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  static async saveSession(userId: string, refreshToken: string) {
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
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Failed to save session');
    }
  }

  static async validateAccessToken(token: string) {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret not configured');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      // Fix: Handle unknown error type
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw new Error('Invalid or expired token');
    }
  }

  static async refreshAccessToken(refreshToken: string) {
    try {
      if (!process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT refresh secret not configured');
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as any;
      
      const session = await prisma.session.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      const { accessToken } = this.generateTokens(session.userId);
      return { accessToken, user: session.user };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Invalid refresh token');
    }
  }
}