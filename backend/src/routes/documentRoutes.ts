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
    const { projectId,folderId,  name, language = 'javascript' } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

     // Check permission
    const hasAccess = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId, role: { in: ['ADMIN', 'EDITOR'] } } } }
        ]
      }
    });

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to create files' });
    }

    const document = await prisma.document.create({
      data: { 
        projectId, 
        folderId: folderId || null,
        name: name.trim(), 
        language: language.toLowerCase(),
        ownerId: userId
      },
      include: {
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json({
      ...document,
      canEdit: true,
      canDelete: true
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Add endpoint to move document to folder
router.put('/:id/move', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;

    const document = await prisma.document.update({
      where: { id },
      data: { folderId: folderId || null }
    });

    res.json(document);
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

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const documentId = req.params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: {
          include: {
            members: {
              where: { userId: userId },
              select: { role: true }
            }
          }
        }
      }
    });;

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const isProjectOwner = document.project.ownerId === userId;
    const isDocOwner = document.ownerId === userId;
    const memberRole = document.project.members[0]?.role;

    res.json({
      ...document,
      canEdit: isProjectOwner || isDocOwner || memberRole === 'ADMIN',
      canDelete: isProjectOwner || isDocOwner || memberRole === 'ADMIN'
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
     const userId = req.user!.userId;
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: {
              where: { userId: userId },
              select: { role: true }
            }
          }
        }
      }
    });
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isProjectOwner = document.project.ownerId === userId;
    const isDocOwner = document.ownerId === userId;
    const memberRole = document.project.members[0]?.role;

    if (!isProjectOwner && !isDocOwner && memberRole !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this file',
        owner: document.ownerId
      });
    }

    await prisma.document.delete({ where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Rename document
router.put('/:id/rename', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const document = await prisma.document.update({
      where: { id },
      data: { name: name.trim(), updatedAt: new Date() }
    });

    res.json(document);
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
            members: {
              where: { userId: userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isProjectOwner = document.project.ownerId === userId;
    const isDocOwner = document.ownerId === userId;
    const memberRole = document.project.members[0]?.role;

    if (!isProjectOwner && !isDocOwner && memberRole !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'You do not have permission to edit this file',
        owner: document.ownerId
      });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { content, updatedAt: new Date() }
    });
    
    res.json(updated);

  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

export default router;