"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const token = authHeader.substring(7);
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'JWT secret not configured' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'access') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=authMiddleware.js.map