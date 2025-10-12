"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../services/authService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Google OAuth login
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Google token is required' });
        }
        console.log('🔍 Verifying Google token...');
        const googleData = await authService_1.AuthService.verifyGoogleToken(token);
        const user = await authService_1.AuthService.createOrUpdateUser(googleData);
        const { accessToken, refreshToken } = authService_1.AuthService.generateTokens(user.id);
        await authService_1.AuthService.saveSession(user.id, refreshToken);
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
    }
    catch (error) {
        console.error('❌ Auth error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
});
// Get current user
router.get('/me', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Logout
router.post('/logout', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await prisma.session.deleteMany({
                where: {
                    token: refreshToken,
                    userId: req.user.userId
                }
            });
        }
        return res.json({ success: true });
    }
    catch (error) {
        return res.json({ success: true });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map