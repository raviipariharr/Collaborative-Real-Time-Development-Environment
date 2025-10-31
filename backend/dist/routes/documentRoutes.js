"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(authMiddleware_1.authMiddleware);
// Create document
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, folderId, name, language = 'javascript' } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ error: 'Project ID and name are required' });
        }
        // Check if user has access to the project
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId: userId } } }
                ]
            },
            include: {
                members: { where: { userId } }
            }
        });
        if (!project) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Check if user can create documents
        const isOwner = project.ownerId === userId;
        const member = project.members[0];
        const canCreate = isOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';
        if (!canCreate) {
            return res.status(403).json({ error: 'You do not have permission to create documents' });
        }
        const document = await prisma.document.create({
            data: {
                projectId,
                folderId: folderId || null,
                name: name.trim(),
                language: language.toLowerCase(),
                content: '// Start coding here...\n'
            }
        });
        res.status(201).json(document);
    }
    catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});
// Move document to folder
router.put('/:id/move', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { folderId } = req.body;
        // Check permission
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        members: { where: { userId } }
                    }
                }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const isOwner = document.project.ownerId === userId;
        const member = document.project.members[0];
        const canMove = isOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';
        if (!canMove) {
            return res.status(403).json({ error: 'You do not have permission to move documents' });
        }
        const updated = await prisma.document.update({
            where: { id },
            data: { folderId: folderId || null }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error moving document:', error);
        res.status(500).json({ error: 'Failed to move document' });
    }
});
// Get project documents
router.get('/project/:projectId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;
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
        const documents = await prisma.document.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(documents);
    }
    catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});
// Get single document
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        members: { where: { userId } }
                    }
                }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // Check access
        const isProjectOwner = document.project.ownerId === userId;
        const isMember = document.project.members.length > 0;
        if (!isProjectOwner && !isMember && !document.project.isPublic) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(document);
    }
    catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});
// Delete document
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        members: { where: { userId } }
                    }
                }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const isProjectOwner = document.project.ownerId === userId;
        const member = document.project.members[0];
        const canDelete = isProjectOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';
        if (!canDelete) {
            return res.status(403).json({ error: 'You do not have permission to delete this document' });
        }
        await prisma.document.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});
// Rename document
router.put('/:id/rename', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        members: { where: { userId } }
                    }
                }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const isProjectOwner = document.project.ownerId === userId;
        const member = document.project.members[0];
        const canRename = isProjectOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';
        if (!canRename) {
            return res.status(403).json({ error: 'You do not have permission to rename this document' });
        }
        const updated = await prisma.document.update({
            where: { id },
            data: { name: name.trim(), updatedAt: new Date() }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error renaming document:', error);
        res.status(500).json({ error: 'Failed to rename document' });
    }
});
// Save document content - FIX 3: PROPER PERMISSION CHECK FOR ROOT FILES
router.put('/:id/content', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { content } = req.body;
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        members: { where: { userId } }
                    }
                },
                folder: {
                    include: {
                        permissions: { where: { userId } }
                    }
                },
                permissions: { where: { userId } }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // Check permissions
        const isProjectOwner = document.project.ownerId === userId;
        const member = document.project.members[0];
        const memberRole = member?.role;
        // FIX 3: STRICT permission logic - NO DEFAULT ACCESS FOR EDITORS
        let canEdit = false;
        // 1. Owner and Admin ALWAYS have edit access
        if (isProjectOwner || memberRole === 'ADMIN') {
            canEdit = true;
        }
        // 2. Check document-level permission (explicit grant for this file)
        else if (document.permissions.length > 0 && document.permissions[0].canEdit) {
            canEdit = true;
        }
        // 3. If document is in a folder, check folder permission
        else if (document.folderId && document.folder) {
            const folderPerm = document.folder.permissions[0];
            if (folderPerm?.canEdit) {
                canEdit = true;
            }
            // No folder permission = cannot edit, even for EDITOR role
        }
        // 4. ROOT FILE (no folder): REQUIRE explicit document permission
        // EDITORS do NOT have automatic access to root files
        else if (!document.folderId) {
            // Root files are NOT editable by default, even for EDITOR role
            canEdit = false;
        }
        if (!canEdit) {
            return res.status(403).json({
                error: 'You do not have permission to edit this document',
                reason: document.folderId
                    ? 'No folder access granted'
                    : 'Root file requires explicit permission',
                canView: true,
                canEdit: false
            });
        }
        const updated = await prisma.document.update({
            where: { id },
            data: {
                content,
                updatedAt: new Date()
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error saving content:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});
exports.default = router;
//# sourceMappingURL=documentRoutes.js.map