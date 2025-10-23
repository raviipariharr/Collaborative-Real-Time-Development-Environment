import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Create document
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { projectId,folderId,  name, language = 'javascript' } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
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

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

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
    const { id } = req.params;
    const { content } = req.body;

    const document = await prisma.document.update({
      where: { id },
      data: { 
        content,
        updatedAt: new Date()
      }
    });
    
    res.json(document);
  } catch (error) {
    console.error('Error saving content:', error);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

export default router;