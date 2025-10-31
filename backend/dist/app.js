"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const invitationRoutes_1 = __importDefault(require("./routes/invitationRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const folderRoutes_1 = __importDefault(require("./routes/folderRoutes"));
const memberRoutes_1 = __importDefault(require("./routes/memberRoutes"));
const folderPermissionRoutes_1 = __importDefault(require("./routes/folderPermissionRoutes"));
const memberPermissionRoutes_1 = __importDefault(require("./routes/memberPermissionRoutes"));
const documentPermissionRoutes_1 = __importDefault(require("./routes/documentPermissionRoutes"));
// Load environment variables
dotenv_1.default.config();
// Initialize Prisma
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [process.env.FRONTEND_URL || 'http://localhost:3000'];
console.log('Allowed CORS origins:', allowedOrigins);
// Initialize Socket.IO with CORS
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
exports.io = io;
// Middleware
app.use((0, helmet_1.default)({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
// CORS with dynamic origin checking
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            console.warn('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: { error: 'Too many requests' },
    skip: (req) => {
        // Skip rate limiting for localhost in development
        if (process.env.NODE_ENV !== 'production') {
            return true;
        }
        return false;
    }
});
if (process.env.NODE_ENV === 'production') {
    app.use('/api/', limiter);
}
else {
    // In development, only limit auth routes
    app.use('/api/auth/', limiter);
    console.log('⚠️  Rate limiting disabled for development (except auth)');
}
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
    }
    catch (error) {
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
app.use('/api/auth', authRoutes_1.default);
app.use('/api/projects', projectRoutes_1.default);
app.use('/api/documents', documentRoutes_1.default);
app.use('/api/invitations', invitationRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/folders', folderRoutes_1.default);
app.use('/api/members', memberRoutes_1.default);
app.use('/api/folder-permissions', folderPermissionRoutes_1.default);
app.use('/api/member-permissions', memberPermissionRoutes_1.default);
app.use('/api/document-permissions', documentPermissionRoutes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
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
    socket.on('join-document', async (data) => {
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
    socket.on('code-change', (data) => {
        const { documentId, code, userId } = data;
        socket.to(documentId).emit('code-update', {
            documentId,
            code,
            userId,
            timestamp: Date.now()
        });
    });
    // Handle cursor position changes
    socket.on('cursor-change', (data) => {
        const { documentId, position, userId, userName } = data;
        socket.to(documentId).emit('cursor-update', {
            userId,
            userName,
            position,
            socketId: socket.id
        });
    });
    // Handle chat messages
    socket.on('send-chat-message', (data) => {
        const { projectId, message } = data;
        io.to(projectId).emit('new-chat-message', message);
    });
    socket.on('join-project-chat', (projectId) => {
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
    }
    catch (error) {
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
exports.default = app;
//# sourceMappingURL=app.js.map