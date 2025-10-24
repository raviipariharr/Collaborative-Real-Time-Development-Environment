import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './authMiddleware';

const prisma = new PrismaClient();

export const checkProjectAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { projectId } = req.params;

    const access = await prisma.project.findFirst({
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

    if (!access) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Attach role to request
    const isOwner = access.ownerId === userId;
    const memberRole = access.members[0]?.role;
    
    req.projectRole = {
      isOwner,
      role: isOwner ? 'ADMIN' : memberRole
    };

    next();
  } catch (error) {
    console.error('Error checking project access:', error);
    res.status(500).json({ error: 'Failed to verify access' });
  }
};

export const checkDocumentPermission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  action: 'read' | 'write'
) => {
  try {
    const userId = req.user!.userId;
    const { id: documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
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

    const isOwner = document.project.ownerId === userId;
    const isDocOwner = document.ownerId === userId;
    const memberRole = document.project.members[0]?.role;

    // Read permission
    if (action === 'read') {
      // Everyone with project access can read
      next();
      return;
    }

    // Write permission
    if (action === 'write') {
      // Project owner, document owner, or ADMIN can write
      if (isOwner || isDocOwner || memberRole === 'ADMIN') {
        next();
        return;
      }
      
      return res.status(403).json({ 
        error: 'You do not have permission to modify this file',
        canView: true,
        canEdit: false
      });
    }

    next();
  } catch (error) {
    console.error('Error checking document permission:', error);
    res.status(500).json({ error: 'Failed to verify permission' });
  }
};

export const checkFolderPermission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  action: 'read' | 'write'
) => {
  try {
    const userId = req.user!.userId;
    const { id: folderId } = req.params;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
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

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const isOwner = folder.project.ownerId === userId;
    const isFolderOwner = folder.ownerId === userId;
    const memberRole = folder.project.members[0]?.role;

    if (action === 'read') {
      next();
      return;
    }

    if (action === 'write') {
      if (isOwner || isFolderOwner || memberRole === 'ADMIN') {
        next();
        return;
      }
      
      return res.status(403).json({ 
        error: 'You do not have permission to modify this folder',
        canView: true,
        canEdit: false
      });
    }

    next();
  } catch (error) {
    console.error('Error checking folder permission:', error);
    res.status(500).json({ error: 'Failed to verify permission' });
  }
};

// Extend AuthRequest interface
declare module './authMiddleware' {
  interface AuthRequest {
    projectRole?: {
      isOwner: boolean;
      role: string;
    };
  }
}