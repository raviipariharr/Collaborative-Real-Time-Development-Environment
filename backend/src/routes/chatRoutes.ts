import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get chat messages for a project
router.get('/project/:projectId', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Check access
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

    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 100 // Last 100 messages
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send chat message
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId, message, replyToId, audioData } = req.body;

    if (!projectId || !message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Project ID and message are required' });
    }

    // Check access
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

    const chatMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        message: message.trim(),
        // Store replyToId and audioData if you add these fields to schema
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    res.status(201).json(chatMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete chat message
router.delete('/:messageId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { messageId } = req.params;

    // Find the message
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        project: {
          include: {
            members: { where: { userId } }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is message owner, project owner, or admin
    const isMessageOwner = message.userId === userId;
    const isProjectOwner = message.project.ownerId === userId;
    const isAdmin = message.project.members.some(m => m.userId === userId && m.role === 'ADMIN');

    if (!isMessageOwner && !isProjectOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Delete the message
    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Mark messages as read
router.post('/mark-read', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Get all unread messages for this user in this project
    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        projectId,
        userId: { not: userId }, // Not sent by current user
        NOT: { readBy: { has: userId } }  // Not read by current user
      }
    });
    
    await Promise.all(
      unreadMessages.map(msg =>
        prisma.chatMessage.update({
          where: { id: msg.id },
          data: {
            readBy: {
              push: userId
            }
          }
        })
      )
    );

    res.json({ success: true, markedCount: unreadMessages.length });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread count
router.get('/unread-count/:projectId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId } = req.params;

    const unreadCount = await prisma.chatMessage.count({
      where: {
        projectId,
        userId: { not: userId },
        NOT: { readBy: { has: userId } }
      }
    });
    
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;