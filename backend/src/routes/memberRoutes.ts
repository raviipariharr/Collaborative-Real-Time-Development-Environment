import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get project members
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
      }
    });

    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json({
      owner: project.ownerId,
      members
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Change member role (only project owner)
router.put('/:memberId/role', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { memberId } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { project: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Only project owner can change roles
    if (member.project.ownerId !== userId) {
      return res.status(403).json({ error: 'Only project owner can change roles' });
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove member (only project owner)
router.delete('/:memberId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { memberId } = req.params;

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { project: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.project.ownerId !== userId) {
      return res.status(403).json({ error: 'Only project owner can remove members' });
    }

    await prisma.projectMember.delete({ where: { id: memberId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;