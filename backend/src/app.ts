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

// Import routes
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import documentRoutes from './routes/documentRoutes';
import invitationRoutes from './routes/invitationRoutes';
import chatRoutes from './routes/chatRoutes';
import folderRoutes from './routes/folderRoutes';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

const app = express();
const server = createServer(app);

// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.FRONTEND_URL || 'http://localhost:3000'];

console.log('Allowed CORS origins:', allowedOrigins);

// Initialize Socket.IO with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

app.use(compression());
app.use(morgan('combined'));

// CORS with dynamic origin checking
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'Connected',
      users: userCount,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'Disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CodeCollab Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      projects: '/api/projects',
      documents: '/api/documents',
      folders: '/api/folders',
      invitations: '/api/invitations',
      chat: '/api/chat'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/folders', folderRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO connection handling
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
    socket.to(documentId).emit('code-update', {
      documentId,
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
  
  // Handle chat messages
  socket.on('send-chat-message', (data: { projectId: string; message: any }) => {
    const { projectId, message } = data;
    io.to(projectId).emit('new-chat-message', message);
  });
  
  socket.on('join-project-chat', (projectId: string) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project chat ${projectId}`);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('user-left', { socketId: socket.id });
  });
});

const PORT = process.env.PORT || 3001;

// Start server
server.listen(PORT, async () => {
  console.log('\n🚀 CodeCollab Backend Server Started!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
  
  console.log('\n✅ Ready for connections!\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
export { io, prisma };