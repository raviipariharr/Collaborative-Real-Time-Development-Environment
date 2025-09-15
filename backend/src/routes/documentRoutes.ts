// backend/src/routes/documentRoutes.ts - NEW FILE
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { prisma } from '../app';

const router = Router();
router.use(authMiddleware);

// Get documents for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    // Check project access
    const hasAccess = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId } } },
          { isPublic: true }
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

// Create new document
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { projectId, name, language = 'javascript' } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    // Check project access
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

    const document = await prisma.document.create({
      data: {
        projectId,
        name: name.trim(),
        language: language.toLowerCase()
      }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Get single document
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const documentId = req.params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            owner: { select: { id: true } },
            members: { select: { userId: true } }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const hasAccess = document.project.ownerId === userId ||
                     document.project.members.some(m => m.userId === userId) ||
                     document.project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

export default router;