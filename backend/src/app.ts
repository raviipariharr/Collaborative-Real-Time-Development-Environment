import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import projectRoutes from './routes/projectRoutes';
import documentRoutes from './routes/documentRoutes';
import invitationRoutes from './routes/invitationRoutes';
// Import routes
import authRoutes from './routes/authRoutes';


dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

const app = express();
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Routes
app.get('/health', async (req, res) => {
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'Connected',
      users: userCount
    });
  } catch (error) {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'Disconnected'
    });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'CodeCollab Backend with Authentication!' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invitations', invitationRoutes);

// Socket.IO
// Update the Socket.IO connection handling section
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join a document room
  socket.on('join-document', async (data: { documentId: string; userId: string; userName: string }) => {
    const { documentId, userId, userName } = data;
    
    socket.join(documentId);
    console.log(`${userName} joined document ${documentId}`);
    
    // Notify others in the room
    socket.to(documentId).emit('user-joined', {
      userId,
      userName,
      socketId: socket.id
    });
    
    // Send list of users in this document
    const sockets = await io.in(documentId).fetchSockets();
    socket.emit('users-in-document', {
      count: sockets.length,
      users: sockets.map(s => ({ socketId: s.id }))
    });
  });
  
  // Handle code changes
  socket.on('code-change', (data: { documentId: string; code: string; userId: string }) => {
    const { documentId, code, userId } = data;
    
    // Broadcast to others in the same document (exclude sender)
    socket.to(documentId).emit('code-update', {
      code,
      userId,
      timestamp: Date.now()
    });
  });
  
  // Handle cursor position changes
  socket.on('cursor-change', (data: { documentId: string; position: any; userId: string; userName: string }) => {
    const { documentId, position, userId, userName } = data;
    
    socket.to(documentId).emit('cursor-update', {
      userId,
      userName,
      position,
      socketId: socket.id
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Notify all rooms this socket was in
    socket.broadcast.emit('user-left', { socketId: socket.id });
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log('\n🚀 CodeCollab Backend with Authentication!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/`);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed');
  }
  
  console.log('✅ Ready for connections!\n');
});

export default app;