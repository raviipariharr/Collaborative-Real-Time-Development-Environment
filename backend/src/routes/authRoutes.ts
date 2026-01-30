import { Router } from 'express';
import { AuthService } from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Google token is required' });
    }

    console.log('🔍 Verifying Google token...');
    
    const googleData = await AuthService.verifyGoogleToken(token);
    const user = await AuthService.createOrUpdateUser(googleData);
    const { accessToken, refreshToken } = AuthService.generateTokens(user.id);
    await AuthService.saveSession(user.id, refreshToken);

    console.log('🎉 User authenticated:', user.email);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { 
          token: refreshToken,
          userId: req.user!.userId 
        }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.json({ success: true });
  }
});

export default router;