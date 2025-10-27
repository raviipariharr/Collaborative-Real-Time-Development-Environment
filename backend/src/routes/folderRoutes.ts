import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { checkFolderPermission } from '../middleware/permissionMiddleware';
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

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // 🔒 Check project access + get role
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: {
          where: { userId },
          select: { role: true }
        }
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isProjectOwner = project.ownerId === userId;
    const memberRole = project.members[0]?.role || (isProjectOwner ? 'OWNER' : 'VIEWER');

    // 📂 Fetch folders and their related documents + owners
    // Add permission flags
     const folders = await prisma.folder.findMany({
      where: { projectId },
      include: {
        children: true,
        documents: true
      },
      orderBy: { name: 'asc' }
    });

    // 🧩 Build consistent response
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
    const hasAccess = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
           { members: { some: { userId, role: { in: ['ADMIN', 'EDITOR'] } }}}
        ]
      }
    });

      if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to create folders' });
    }

    const folder = await prisma.folder.create({
      data: {
        projectId,
        name: name.trim(),
        parentId: parentId || null,
        ownerId: userId
      },
      include: {
        owner: { select: { id: true, name: true, email: true } }
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
            members: {
              where: { userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    const isProjectOwner = folder.project.ownerId === userId;
    const isFolderOwner = folder.ownerId === userId;
    const memberRole = folder.project.members[0]?.role;
    
    if (!isProjectOwner && !isFolderOwner && memberRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'You do not have permission to rename this folder',
        owner: folder.ownerId
      });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name: name.trim(), updatedAt: new Date() },
      include: {
        owner: { select: { id: true, name: true, email: true } }
      }
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
            members: {
              where: { userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    const isProjectOwner = folder.project.ownerId === userId;
    const isFolderOwner = folder.ownerId === userId;
    const memberRole = folder.project.members[0]?.role;

    if (!isProjectOwner && !isFolderOwner && memberRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'You do not have permission to delete this folder',
        owner: folder.ownerId
      });
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

// Delete folder (check permission)

router.get('/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId } } }
        ]
      },
      include: {
        members: {
          where: { userId: userId },
          select: { role: true }
        }
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isProjectOwner = project.ownerId === userId;
    const memberRole = project.members[0]?.role;

    const documents = await prisma.document.findMany({
      where: { projectId },
      include: {
        owner: { select: { id: true, name: true, email: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const documentsWithPermissions = documents.map(doc => ({
      ...doc,
      canEdit: isProjectOwner || doc.ownerId === userId || memberRole === 'ADMIN',
      canDelete: isProjectOwner || doc.ownerId === userId || memberRole === 'ADMIN'
    }));

    res.json(documentsWithPermissions);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

export default router;