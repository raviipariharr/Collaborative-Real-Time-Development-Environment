"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(authMiddleware_1.authMiddleware);
// Get chat messages for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        // Check access
        const hasAccess = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId: userId } } }
                ]
            }
        });
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const messages = await prisma.chatMessage.findMany({
            where: { projectId },
            include: {
                user: {
                    select: { id: true, name: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'asc' },
            take: 100 // Last 100 messages
        });
        res.json(messages);
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
// Send chat message
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, message } = req.body;
        if (!projectId || !message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Project ID and message are required' });
        }
        // Check access
        const hasAccess = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId: userId } } }
                ]
            }
        });
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const chatMessage = await prisma.chatMessage.create({
            data: {
                projectId,
                userId,
                message: message.trim()
            },
            include: {
                user: {
                    select: { id: true, name: true, avatar: true }
                }
            }
        });
        res.status(201).json(chatMessage);
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
// Mark messages as read
router.post('/mark-read', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        // Get all unread messages for this user in this project
        const unreadMessages = await prisma.chatMessage.findMany({
            where: {
                projectId,
                userId: { not: userId }, // Not sent by current user
                NOT: { readBy: { has: userId } } // Not read by current user
            }
        });
        await Promise.all(unreadMessages.map(msg => prisma.chatMessage.update({
            where: { id: msg.id },
            data: {
                readBy: {
                    push: userId
                }
            }
        })));
        res.json({ success: true, markedCount: unreadMessages.length });
    }
    catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});
// Get unread count
router.get('/unread-count/:projectId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;
        const unreadCount = await prisma.chatMessage.count({
            where: {
                projectId,
                userId: { not: userId },
                NOT: { readBy: { has: userId } }
            }
        });
        res.json({ unreadCount });
    }
    catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map