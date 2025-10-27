import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Create document
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Move document to folder
router.put('/:id/move', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error moving document:', error);
    res.status(500).json({ error: 'Failed to move document' });
  }
});

// Get project documents
router.get('/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Delete document
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Rename document
router.put('/:id/rename', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error renaming document:', error);
    res.status(500).json({ error: 'Failed to rename document' });
  }
});

// Save document content
router.put('/:id/content', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check permissions
    const isProjectOwner = document.project.ownerId === userId;
    const member = document.project.members[0];
    const memberRole = member?.role;

    // Check folder-level permission
    let hasFolderPermission = false;
    if (document.folderId && document.folder) {
      const folderPerm = document.folder.permissions[0];
      hasFolderPermission = folderPerm?.canEdit || false;
    }

    // Permission logic:
    // 1. Owner/Admin always can edit
    // 2. If folder permission exists, use it (overrides role)
    // 3. Otherwise, use role (EDITOR can edit)
    const canEdit = 
      isProjectOwner || 
      memberRole === 'ADMIN' || 
      (document.folderId ? hasFolderPermission : memberRole === 'EDITOR');

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this document' });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { 
        content,
        updatedAt: new Date()
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error saving content:', error);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

export default router;