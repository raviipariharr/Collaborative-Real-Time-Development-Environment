import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
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
        picture: payload.picture
      };
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new Error('Invalid Google token');
    }
  }

  static async createOrUpdateUser(googleData: GoogleTokenPayload) {
    const { sub: googleId, email, name, picture } = googleData;

    try {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { googleId }
      });

      if (!user) {
        // Create new user - handle undefined avatar properly
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            name,
            avatar: picture || null // Convert undefined to null
          }
        });
        console.log('✅ New user created:', user.email);
      } else {
        // Update existing user - handle undefined avatar properly
        user = await prisma.user.update({
          where: { googleId },
          data: {
            email,
            name,
            avatar: picture || null, // Convert undefined to null
            updatedAt: new Date()
          }
        });
        console.log('✅ User updated:', user.email);
      }

      return user;
    } catch (error) {
      console.error('Database operation failed:', error);
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
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await prisma.session.create({
        data: {
          userId,
          token: refreshToken,
          expiresAt
        }
      });

      console.log('✅ Session saved for user:', userId);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw new Error('Failed to save session');
    }
  }
}