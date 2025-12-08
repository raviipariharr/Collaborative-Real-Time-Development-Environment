import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get folder structure for a project
router.get('/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

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

    // Get all folders and documents
    const folders = await prisma.folder.findMany({
      where: { projectId },
      include: {
        children: true,
        documents: true
      },
      orderBy: { name: 'asc' }
    });

    // IMPORTANT: Always return an array
    res.json(Array.isArray(folders) ? folders : []);
  } catch (error) {
    console.error('Error fetching folders:', error);
    // Return empty array on error instead of error object
    res.status(500).json([]);
  }
});

// Create folder
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId, name, parentId } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    // Check access
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

    // Check if user can create folders
    const isOwner = project.ownerId === userId;
    const member = project.members[0];
    const canCreate = isOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';

    if (!canCreate) {
      return res.status(403).json({ error: 'You do not have permission to create folders' });
    }

    const folder = await prisma.folder.create({
      data: {
        projectId,
        name: name.trim(),
        parentId: parentId || null
      }
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename folder
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const folder = await prisma.folder.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: { where: { userId } }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const isProjectOwner = folder.project.ownerId === userId;
    const member = folder.project.members[0];
    const canRename = isProjectOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';

    if (!canRename) {
      return res.status(403).json({ error: 'You do not have permission to rename folders' });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name: name.trim(), updatedAt: new Date() }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete folder
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const folder = await prisma.folder.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: { where: { userId } }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const isProjectOwner = folder.project.ownerId === userId;
    const member = folder.project.members[0];
    const canDelete = isProjectOwner || member?.role === 'ADMIN' || member?.role === 'EDITOR';

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete folders' });
    }

    await prisma.folder.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

export default router;