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
// Create project
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Create project and add owner as member in a transaction
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: Boolean(isPublic),
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'ADMIN'
          }
        }
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { documents: true, members: true } }
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

// Update project (rename/edit)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const projectId = req.params.id;
    const { name, description, isPublic } = req.body;

    // Check if user is project owner
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
        updatedAt: new Date()
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { documents: true, members: true } }
      }
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const projectId = req.params.id;

    // Check if user is project owner
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    await prisma.project.delete({
      where: { id: projectId }
    });

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get project members with roles
router.get('/:id/members', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const projectId = req.params.id;

    // Check if user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId } } },
          { isPublic: true }
        ]
      }
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

     // Get all members with their details
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

export default router;