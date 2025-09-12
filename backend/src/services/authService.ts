// backend/src/services/authService.ts
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../app';

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
      throw new Error('Invalid Google token');
    }
  }

  static async createOrUpdateUser(googleData: GoogleTokenPayload) {
    const { sub: googleId, email, name, picture } = googleData;

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { googleId }
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          name,
          avatar: picture
        }
      });
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { googleId },
        data: {
          email,
          name,
          avatar: picture,
          updatedAt: new Date()
        }
      });
    }

    return user;
  }

  static generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  static async saveSession(userId: string, refreshToken: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt
      }
    });
  }
}