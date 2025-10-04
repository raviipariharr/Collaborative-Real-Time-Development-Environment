import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Create document
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { projectId, name, language = 'javascript' } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    const document = await prisma.document.create({
      data: { projectId, name: name.trim(), language: language.toLowerCase() }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Get project documents
router.get('/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;

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

export default router;