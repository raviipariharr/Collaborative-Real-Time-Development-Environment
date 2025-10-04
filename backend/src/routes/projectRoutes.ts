import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get all projects
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

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
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: Boolean(isPublic),
        ownerId: userId
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } }
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get single project
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

export default router;