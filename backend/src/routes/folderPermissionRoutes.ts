import express from 'express';
import prisma from '../prismaClient';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { folderId, userId, canEdit, canDelete } = req.body;
    const permission = await prisma.folderPermission.create({
      data: { folderId, userId, canEdit, canDelete },
    });
    res.json(permission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add permission' });
  }
});

export default router;
