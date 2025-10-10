"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(authMiddleware_1.authMiddleware);
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
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
        const folders = await prisma.folder.findMany({
            where: { projectId },
            include: {
                children: true,
                documents: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(folders);
    }
    catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, name, parentId } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ error: 'Project ID and name are required' });
        }
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
        const folder = await prisma.folder.create({
            data: {
                projectId,
                name: name.trim(),
                parentId: parentId || null
            }
        });
        res.status(201).json(folder);
    }
    catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const folder = await prisma.folder.update({
            where: { id },
            data: { name: name.trim(), updatedAt: new Date() }
        });
        res.json(folder);
    }
    catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.folder.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});
exports.default = router;
//# sourceMappingURL=folderRoutes.js.map