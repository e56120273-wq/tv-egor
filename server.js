const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(__dirname));

let channelsState = {};
for (let i = 1; i <= 50; i++) {
    channelsState[i] = { status: 'afk', videoUrl: '', channelName: `Канал ${i}`, startTime: 0 };
}

let usersDb = {};

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
    res.json({ videoUrl: '/uploads/' + req.file.filename });
});

io.on('connection', (socket) => {
    socket.emit('init_state', { channelsState, usersDb });

    socket.on('user_login', ({ nick, isCreator }) => {
        socket.nick = nick;
        usersDb[nick] = { online: true, isCreator };
        io.emit('users_update', usersDb);
    });

    socket.on('update_channel', ({ channelNum, data }) => {
        channelsState[channelNum] = data;
        io.emit('channel_updated', { channelNum, data });
    });

    socket.on('disconnect', () => {
        if (socket.nick && usersDb[socket.nick]) {
            usersDb[socket.nick].online = false;
            io.emit('users_update', usersDb);
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Сервер запущен! Откройте в браузере: http://localhost:3000');
});
