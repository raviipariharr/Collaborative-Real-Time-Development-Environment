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
import chatRoutes from './routes/chatRoutes';
import authRoutes from './routes/authRoutes';
import folderRoutes from './routes/folderRoutes';



dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const app = express();
const server = createServer(app);



// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('combined'));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'https://accounts.google.com',
  'https://www.google.com'
].filter((origin): origin is string => !!origin);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'], // allow OPTIONS
  credentials: true
}));

// Handle preflight OPTIONS requests for all routes
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST','OPTIONS'],
    credentials: true
  }
});

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
app.use('/api/chat', chatRoutes);
app.use('/api/folders', folderRoutes);

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

  // Handle chat messages
  socket.on('send-chat-message', (data: { projectId: string; message: any }) => {
    const { projectId, message } = data;
    
    // Broadcast chat message to everyone in the project
    io.to(projectId).emit('new-chat-message', message);
  });
  
  socket.on('join-project-chat', (projectId: string) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project chat ${projectId}`);
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

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    server.listen(PORT, () => {
      console.log('\n🚀 CodeCollab Backend with Authentication!');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/`);
      console.log('✅ Ready for connections!\n');
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1); // stop server if DB cannot connect
  }
};
startServer();


export default app;