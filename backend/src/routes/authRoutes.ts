// backend/src/routes/authRoutes.ts - Simple version first
import { Router } from 'express';

const router = Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

// Google login placeholder
router.post('/google', (req, res) => {
  res.json({ message: 'Google auth endpoint - will implement after database setup' });
});

export default router;