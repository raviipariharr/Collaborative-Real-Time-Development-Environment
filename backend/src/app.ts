import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import prisma from './lib/prisma'; // CHANGED: Use singleton

// Import routes
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import documentRoutes from './routes/documentRoutes';
import invitationRoutes from './routes/invitationRoutes';
import chatRoutes from './routes/chatRoutes';
import folderRoutes from './routes/folderRoutes';
import memberRoutes from './routes/memberRoutes';
import folderPermissionRoutes from './routes/folderPermissionRoutes';
import memberPermissionRoutes from './routes/memberPermissionRoutes';
import documentPermissionRoutes from './routes/documentPermissionRoutes';

// Load environment variables
dotenv.config();

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
  },
  // ADDED: Optimize Socket.IO
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

app.use(compression());

// ADDED: Trust proxy for Render
app.set('trust proxy', 1);

// Optimize morgan logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS with dynamic origin checking
app.use(cors({
  origin: function(origin, callback) {
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

// IMPROVED: Separate rate limiters for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // Strict for auth
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 1000, // More lenient for API
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production'
});

// Apply rate limiters
app.use('/api/auth', authLimiter);
if (process.env.NODE_ENV === 'production') {
  app.use('/api', apiLimiter);
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Quick DB check
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'Connected',
      users: userCount,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
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
app.use('/api/members', memberRoutes);
app.use('/api/folder-permissions', folderPermissionRoutes);
app.use('/api/member-permissions', memberPermissionRoutes);
app.use('/api/document-permissions', documentPermissionRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO connection handling with optimization
const activeUsers = new Map<string, Set<string>>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-document', async (data: { documentId: string; userId: string; userName: string }) => {
    const { documentId, userId, userName } = data;
    
    socket.join(documentId);
    
    // Track active users
    if (!activeUsers.has(documentId)) {
      activeUsers.set(documentId, new Set());
    }
    activeUsers.get(documentId)!.add(userId);
    
    socket.to(documentId).emit('user-joined', {
      userId,
      userName,
      socketId: socket.id
    });
    
    const sockets = await io.in(documentId).fetchSockets();
    socket.emit('users-in-document', {
      count: sockets.length,
      users: sockets.map(s => ({ socketId: s.id }))
    });
  });
  
  // OPTIMIZED: Debounce code changes
  let codeChangeTimeout: NodeJS.Timeout | null = null;
  socket.on('code-change', (data: { documentId: string; code: string; userId: string }) => {
    if (codeChangeTimeout) clearTimeout(codeChangeTimeout);
    
    codeChangeTimeout = setTimeout(() => {
      socket.to(data.documentId).emit('code-update', {
        documentId: data.documentId,
        code: data.code,
        userId: data.userId,
        timestamp: Date.now()
      });
    }, 100); // 100ms debounce
  });
  
  socket.on('cursor-change', (data: { documentId: string; position: any; userId: string; userName: string }) => {
    socket.to(data.documentId).emit('cursor-update', {
      userId: data.userId,
      userName: data.userName,
      position: data.position,
      socketId: socket.id
    });
  });
  
  socket.on('send-chat-message', (data: { projectId: string; message: any }) => {
    io.to(data.projectId).emit('new-chat-message', data.message);
  });
  
  socket.on('join-project-chat', (projectId: string) => {
    socket.join(projectId);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('user-left', { socketId: socket.id });
    
    // Clean up active users
    activeUsers.forEach((users, documentId) => {
      users.forEach(userId => {
        // Remove user if no more sockets
        io.in(documentId).fetchSockets().then(sockets => {
          if (sockets.length === 0) {
            activeUsers.delete(documentId);
          }
        });
      });
    });
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
const shutdown = async () => {
  console.log('🔄 Shutting down gracefully...');
  
  // Close Socket.IO connections
  io.close();
  
  // Disconnect Prisma
  await prisma.$disconnect();
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
export { io, prisma };