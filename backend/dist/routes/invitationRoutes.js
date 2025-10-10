"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(authMiddleware_1.authMiddleware);
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, email, role = 'EDITOR' } = req.body;
        if (!projectId || !email) {
            return res.status(400).json({ error: 'Project ID and email are required' });
        }
        const project = await prisma.project.findFirst({
            where: { id: projectId, ownerId: userId },
            include: { owner: true }
        });
        if (!project) {
            return res.status(403).json({ error: 'You do not have permission to invite users to this project' });
        }
        const existingMember = await prisma.projectMember.findFirst({
            where: { projectId, user: { email } }
        });
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this project' });
        }
        const existingInvite = await prisma.projectInvitation.findFirst({
            where: { projectId, email, status: 'PENDING' }
        });
        if (existingInvite) {
            return res.status(400).json({ error: 'Invitation already sent to this email' });
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const invitation = await prisma.projectInvitation.create({
            data: {
                projectId,
                email,
                role,
                invitedBy: userId,
                token,
                expiresAt
            },
            include: {
                project: { select: { name: true, description: true } },
                inviter: { select: { name: true, email: true } }
            }
        });
        res.status(201).json({
            message: 'Invitation sent successfully',
            invitation: {
                id: invitation.id,
                email: invitation.email,
                projectName: invitation.project.name,
                inviterName: invitation.inviter.name,
                token: invitation.token
            }
        });
    }
    catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});
router.get('/pending', async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const invitations = await prisma.projectInvitation.findMany({
            where: {
                email: user.email,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                project: { select: { id: true, name: true, description: true } },
                inviter: { select: { name: true, email: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invitations);
    }
    catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});
router.post('/:id/accept', async (req, res) => {
    try {
        const userId = req.user.userId;
        const invitationId = req.params.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const invitation = await prisma.projectInvitation.findUnique({
            where: { id: invitationId },
            include: { project: true }
        });
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }
        if (invitation.email !== user.email) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }
        if (invitation.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invitation has already been processed' });
        }
        if (invitation.expiresAt < new Date()) {
            await prisma.projectInvitation.update({
                where: { id: invitationId },
                data: { status: 'EXPIRED' }
            });
            return res.status(400).json({ error: 'Invitation has expired' });
        }
        await prisma.projectMember.create({
            data: {
                projectId: invitation.projectId,
                userId: userId,
                role: invitation.role
            }
        });
        await prisma.projectInvitation.update({
            where: { id: invitationId },
            data: { status: 'ACCEPTED' }
        });
        res.json({
            message: 'Invitation accepted successfully',
            project: invitation.project
        });
    }
    catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const userId = req.user.userId;
        const invitationId = req.params.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        const invitation = await prisma.projectInvitation.findUnique({
            where: { id: invitationId }
        });
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }
        if (invitation.email !== user?.email) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }
        await prisma.projectInvitation.update({
            where: { id: invitationId },
            data: { status: 'REJECTED' }
        });
        res.json({ message: 'Invitation rejected' });
    }
    catch (error) {
        console.error('Error rejecting invitation:', error);
        res.status(500).json({ error: 'Failed to reject invitation' });
    }
});
router.get('/project/:projectId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const projectId = req.params.projectId;
        const project = await prisma.project.findFirst({
            where: { id: projectId, ownerId: userId }
        });
        if (!project) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const invitations = await prisma.projectInvitation.findMany({
            where: { projectId },
            include: {
                inviter: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invitations);
    }
    catch (error) {
        console.error('Error fetching project invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});
exports.default = router;
//# sourceMappingURL=invitationRoutes.js.map