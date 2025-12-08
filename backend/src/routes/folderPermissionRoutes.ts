import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get folder permissions
router.get('/:folderId', async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user!.userId;

    // Check if user has access to the project
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
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

    // Check access
    const isOwner = folder.project.ownerId === userId;
    const isMember = folder.project.members.length > 0;

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const permissions = await prisma.folderPermission.findMany({
      where: { folderId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching folder permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Set folder permissions (Owner/Admin only)
router.post('/:folderId/grant', async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const { userId: targetUserId, canEdit, canDelete } = req.body;
    const currentUserId = req.user!.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get folder and check permissions
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        project: {
          include: {
            members: { where: { userId: currentUserId } }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Only owner or admin can grant permissions
    const isOwner = folder.project.ownerId === currentUserId;
    const member = folder.project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only project owner or admin can grant folder permissions' });
    }

    // Check if target user is a project member
    const targetMember = await prisma.projectMember.findFirst({
      where: {
        projectId: folder.projectId,
        userId: targetUserId
      }
    });

    if (!targetMember) {
      return res.status(400).json({ error: 'User is not a member of this project' });
    }

    // Create or update permission
    const permission = await prisma.folderPermission.upsert({
      where: {
        folderId_userId: {
          folderId,
          userId: targetUserId
        }
      },
      update: {
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false
      },
      create: {
        folderId,
        userId: targetUserId,
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(permission);
  } catch (error) {
    console.error('Error granting folder permission:', error);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

// Revoke folder permissions
router.delete('/:folderId/revoke/:userId', async (req: AuthRequest, res) => {
  try {
    const { folderId, userId: targetUserId } = req.params;
    const currentUserId = req.user!.userId;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        project: {
          include: {
            members: { where: { userId: currentUserId } }
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const isOwner = folder.project.ownerId === currentUserId;
    const member = folder.project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only project owner or admin can revoke permissions' });
    }

    await prisma.folderPermission.deleteMany({
      where: {
        folderId,
        userId: targetUserId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

// Check if current user can edit a specific folder
router.get('/:folderId/can-edit', async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user!.userId;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        project: {
          include: {
            members: { where: { userId } }
          }
        },
        permissions: { where: { userId } }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const isOwner = folder.project.ownerId === userId;
    const member = folder.project.members[0];
    const isAdmin = member?.role === 'ADMIN';
    const isEditor = member?.role === 'EDITOR';
    const hasPermission = folder.permissions.length > 0 && folder.permissions[0].canEdit;

    // Can edit if: Owner, Admin, Editor with permission, or has explicit permission
    const canEdit = isOwner || isAdmin || (isEditor && hasPermission) || hasPermission;

    res.json({ canEdit, isOwner, role: member?.role });
  } catch (error) {
    console.error('Error checking folder permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;