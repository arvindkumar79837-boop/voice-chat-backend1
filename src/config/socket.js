let io;

const getIO = () => {
    if (!io) {
        throw new Error('Socket Not Initialized');
    }
    return io;
};

const setIO = (ioInstance) => {
    io = ioInstance;
};

const emitToUser = (userId, event, data) => {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
};

module.exports = {
    getIO,
    setIO,
    emitToUser
};
