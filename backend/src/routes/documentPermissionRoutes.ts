import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get document permissions
router.get('/:documentId', async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    // Check if user has access to the project
    const document = await prisma.document.findUnique({
      where: { id: documentId },
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
    const isOwner = document.project.ownerId === userId;
    const isMember = document.project.members.length > 0;

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const permissions = await prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching document permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Set document permissions (Owner/Admin only)
router.post('/:documentId/grant', async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const { userId: targetUserId, canEdit, canDelete } = req.body;
    const currentUserId = req.user!.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get document and check permissions
    const document = await prisma.document.findUnique({
      where: { id: documentId },
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

    // Only owner or admin can grant permissions
    const isOwner = document.project.ownerId === currentUserId;
    const member = document.project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only project owner or admin can grant document permissions' });
    }

    // Check if target user is a project member
    const targetMember = await prisma.projectMember.findFirst({
      where: {
        projectId: document.projectId,
        userId: targetUserId
      }
    });

    if (!targetMember) {
      return res.status(400).json({ error: 'User is not a member of this project' });
    }

    // Create or update permission
    const permission = await prisma.documentPermission.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: targetUserId
        }
      },
      update: {
        canEdit: canEdit ?? false,
        canDelete: canDelete ?? false
      },
      create: {
        documentId,
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
    console.error('Error granting document permission:', error);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

// Revoke document permissions
router.delete('/:documentId/revoke/:userId', async (req: AuthRequest, res) => {
  try {
    const { documentId, userId: targetUserId } = req.params;
    const currentUserId = req.user!.userId;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
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
      return res.status(403).json({ error: 'Only project owner or admin can revoke permissions' });
    }

    await prisma.documentPermission.deleteMany({
      where: {
        documentId,
        userId: targetUserId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

// Check if current user can edit a specific document - FIXED WITH DETAILED LOGGING
router.get('/:documentId/can-edit', async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    console.log(`\n🔍 Backend: Checking can-edit for document ${documentId}`);
    console.log(`   - User: ${userId}`);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
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
        },
        permissions: { where: { userId } }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isOwner = document.project.ownerId === userId;
    const member = document.project.members[0];
    const isAdmin = member?.role === 'ADMIN';

    console.log(`   - Is Owner: ${isOwner}`);
    console.log(`   - Member Role: ${member?.role}`);
    console.log(`   - Document Permissions: ${JSON.stringify(document.permissions)}`);
    console.log(`   - Folder ID: ${document.folderId}`);
    console.log(`   - Folder Permissions: ${JSON.stringify(document.folder?.permissions)}`);

    // Check if user can edit this document
    let canEdit = false;

    // Owner and Admin always can edit
    if (isOwner || isAdmin) {
      console.log(`✅ Can edit: Owner or Admin`);
      canEdit = true;
    }
    // CRITICAL: Check document-level permission FIRST
    else if (document.permissions.length > 0 && document.permissions[0].canEdit) {
      console.log(`✅ Can edit: Explicit document permission (canEdit: ${document.permissions[0].canEdit})`);
      canEdit = true;
    }
    // Check folder permission if document is in a folder
    else if (document.folderId && document.folder) {
      const folderPerm = document.folder.permissions[0];
      if (folderPerm?.canEdit) {
        console.log(`✅ Can edit: Folder permission`);
        canEdit = true;
      } else {
        console.log(`❌ Cannot edit: No folder permission`);
      }
    }
    // Root files: NO default access for EDITOR role
    else {
      console.log(`❌ Cannot edit: No explicit permission for root file or folder access`);
      canEdit = false;
    }

    console.log(`\n📤 Backend: Returning canEdit=${canEdit} for document ${documentId}\n`);

    res.json({ canEdit, isOwner, role: member?.role });
  } catch (error) {
    console.error('Error checking document permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

export default router;