backend> cat src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

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

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'aaa
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'CodeCollab Backend is running!' });
});

app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

io.on('connection', (socket) => {
  console.log('ðŸ‘¤ User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('ðŸ‘‹ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('\nðŸš€ CodeCollab Backend Server Started!');
  console.log(`ðŸ“ Server: http://localhost:${PORT}`);
  console.log(`ðŸ“Š Health: http://localhost:${PORT}/health`);
  console.log('âœ… Ready for connections!\n');
});

export default app;