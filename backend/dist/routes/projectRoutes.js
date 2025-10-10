"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(authMiddleware_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const projects = await prisma.project.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId: userId } } },
                    { isPublic: true }
                ]
            },
            include: {
                owner: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { documents: true, members: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(projects);
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, description, isPublic } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                isPublic: Boolean(isPublic),
                ownerId: userId,
                members: {
                    create: {
                        userId: userId,
                        role: 'ADMIN'
                    }
                }
            },
            include: {
                owner: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { documents: true, members: true } }
            }
        });
        res.status(201).json(project);
    }
    catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const projectId = req.params.id;
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId: userId } } },
                    { isPublic: true }
                ]
            },
            include: {
                owner: { select: { id: true, name: true, email: true, avatar: true } },
                documents: { orderBy: { updatedAt: 'desc' } }
            }
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    }
    catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const projectId = req.params.id;
        const { name, description, isPublic } = req.body;
        const project = await prisma.project.findFirst({
            where: { id: projectId, ownerId: userId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }
        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
                updatedAt: new Date()
            },
            include: {
                owner: { select: { id: true, name: true, email: true, avatar: true } },
                _count: { select: { documents: true, members: true } }
            }
        });
        res.json(updatedProject);
    }
    catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const projectId = req.params.id;
        const project = await prisma.project.findFirst({
            where: { id: projectId, ownerId: userId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }
        await prisma.project.delete({
            where: { id: projectId }
        });
        res.json({ success: true, message: 'Project deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});
exports.default = router;
//# sourceMappingURL=projectRoutes.js.map