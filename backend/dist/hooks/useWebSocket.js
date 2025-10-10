"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWebSocket = void 0;
const react_1 = require("react");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const useWebSocket = (documentId, userId, userName) => {
    const socketRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        socketRef.current = (0, socket_io_client_1.default)(SOCKET_URL);
        const socket = socketRef.current;
        socket.on('connect', () => {
            console.log('WebSocket connected');
            socket.emit('join-document', { documentId, userId, userName });
        });
        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
        });
        return () => {
            socket.disconnect();
        };
    }, [documentId, userId, userName]);
    return socketRef.current;
};
exports.useWebSocket = useWebSocket;
//# sourceMappingURL=useWebSocket.js.map