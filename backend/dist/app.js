"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const invitationRoutes_1 = __importDefault(require("./routes/invitationRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const folderRoutes_1 = __importDefault(require("./routes/folderRoutes"));
dotenv_1.default.config();
// Initialize Prisma
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});
// Middleware
app.use((0, helmet_1.default)({ crossOriginEmbedderPolicy: false }));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
const limiter = (0, express_rate_limit_1.default)({
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
    }
    catch (error) {
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
app.use('/api/auth', authRoutes_1.default);
app.use('/api/projects', projectRoutes_1.default);
app.use('/api/documents', documentRoutes_1.default);
app.use('/api/invitations', invitationRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/folders', folderRoutes_1.default);
// Socket.IO
// Update the Socket.IO connection handling section
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
    // Handle chat messages
    socket.on('send-chat-message', (data) => {
        const { projectId, message } = data;
        // Broadcast chat message to everyone in the project
        io.to(projectId).emit('new-chat-message', message);
    });
    socket.on('join-project-chat', (projectId) => {
        socket.join(projectId);
        console.log(`Socket ${socket.id} joined project chat ${projectId}`);
    });
    // Handle code changes
    socket.on('code-change', (data) => {
        const { documentId, code, userId } = data;
        // Broadcast to others in the same document (exclude sender)
        socket.to(documentId).emit('code-update', {
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
    }
    catch (error) {
        console.error('❌ Database connection failed');
    }
    console.log('✅ Ready for connections!\n');
});
exports.default = app;
//# sourceMappingURL=app.js.map