import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get all permissions for a member in a project
router.get('/user/:userId/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const { userId, projectId } = req.params;
    const currentUserId = req.user!.userId;

    // Check if current user can view permissions (owner/admin)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: currentUserId } }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.ownerId === currentUserId;
    const member = project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only owner/admin can view member permissions' });
    }

    // Get folder permissions
    const folderPermissions = await prisma.folderPermission.findMany({
      where: { 
        userId,
        folder: { projectId }
      },
      include: {
        folder: { select: { id: true, name: true } }
      }
    });

    // Get document permissions
    const documentPermissions = await prisma.documentPermission.findMany({
      where: {
        userId,
        document: { projectId }
      },
      include: {
        document: { select: { id: true, name: true } }
      }
    });

    const permissions = [
      ...folderPermissions.map(p => ({
        id: p.id,
        type: 'folder' as const,
        resourceId: p.folderId,
        resourceName: p.folder.name,
        canEdit: p.canEdit,
        canDelete: p.canDelete
      })),
      ...documentPermissions.map(p => ({
        id: p.id,
        type: 'document' as const,
        resourceId: p.documentId,
        resourceName: p.document.name,
        canEdit: p.canEdit,
        canDelete: p.canDelete
      }))
    ];

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching member permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Grant permission to a member
router.post('/grant', async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const { userId, projectId, type, resourceId, canEdit, canDelete } = req.body;

    if (!userId || !projectId || !type || !resourceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if current user can grant permissions (owner/admin)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: currentUserId } }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.ownerId === currentUserId;
    const member = project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only owner/admin can grant permissions' });
    }

    // Check if target user is a project member
    const targetMember = await prisma.projectMember.findFirst({
      where: { projectId, userId }
    });

    if (!targetMember) {
      return res.status(400).json({ error: 'User is not a member of this project' });
    }

    let permission;

    if (type === 'folder') {
      // Grant folder permission
      permission = await prisma.folderPermission.upsert({
        where: {
          folderId_userId: {
            folderId: resourceId,
            userId
          }
        },
        update: {
          canEdit: canEdit ?? true,
          canDelete: canDelete ?? false
        },
        create: {
          folderId: resourceId,
          userId,
          canEdit: canEdit ?? true,
          canDelete: canDelete ?? false
        }
      });
    } else if (type === 'document') {
      // Grant document permission
      permission = await prisma.documentPermission.upsert({
        where: {
          documentId_userId: {
            documentId: resourceId,
            userId
          }
        },
        update: {
          canEdit: canEdit ?? true,
          canDelete: canDelete ?? false
        },
        create: {
          documentId: resourceId,
          userId,
          canEdit: canEdit ?? true,
          canDelete: canDelete ?? false
        }
      });
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    res.json({ id: permission.id, type, resourceId, canEdit: permission.canEdit, canDelete: permission.canDelete });
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

// Update permission
router.put('/:permissionId', async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const { permissionId } = req.params;
    const { type, canEdit, canDelete } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Type is required' });
    }

    // Check ownership first
    let permission;
    let projectId;

    if (type === 'folder') {
      permission = await prisma.folderPermission.findUnique({
        where: { id: permissionId },
        include: {
          folder: {
            include: {
              project: {
                include: {
                  members: { where: { userId: currentUserId } }
                }
              }
            }
          }
        }
      });

      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      projectId = permission.folder.projectId;
      const isOwner = permission.folder.project.ownerId === currentUserId;
      const member = permission.folder.project.members[0];
      const isAdmin = member?.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updated = await prisma.folderPermission.update({
        where: { id: permissionId },
        data: {
          canEdit: canEdit ?? permission.canEdit,
          canDelete: canDelete ?? permission.canDelete
        }
      });

      res.json(updated);
    } else if (type === 'document') {
      permission = await prisma.documentPermission.findUnique({
        where: { id: permissionId },
        include: {
          document: {
            include: {
              project: {
                include: {
                  members: { where: { userId: currentUserId } }
                }
              }
            }
          }
        }
      });

      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      projectId = permission.document.projectId;
      const isOwner = permission.document.project.ownerId === currentUserId;
      const member = permission.document.project.members[0];
      const isAdmin = member?.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updated = await prisma.documentPermission.update({
        where: { id: permissionId },
        data: {
          canEdit: canEdit ?? permission.canEdit,
          canDelete: canDelete ?? permission.canDelete
        }
      });

      res.json(updated);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Revoke permission
router.delete('/user/:userId/type/:type/resource/:resourceId', async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const { userId, type, resourceId } = req.params;

    if (type === 'folder') {
      // Check ownership
      const folder = await prisma.folder.findUnique({
        where: { id: resourceId },
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
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.folderPermission.deleteMany({
        where: {
          folderId: resourceId,
          userId
        }
      });
    } else if (type === 'document') {
      // Check ownership
      const document = await prisma.document.findUnique({
        where: { id: resourceId },
        include: {
          project: {
            include: {
              members: { where: { userId: currentUserId } }
            }
          }
        }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const isOwner = document.project.ownerId === currentUserId;
      const member = document.project.members[0];
      const isAdmin = member?.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.documentPermission.deleteMany({
        where: {
          documentId: resourceId,
          userId
        }
      });
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

export default router;