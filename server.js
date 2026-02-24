const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// 初始化 Socket.io 并解决跨域
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(express.static('public')); // 确保你的 HTML 文件在 public 文件夹里

// 房间状态存内存即可（简单版本）
const rooms = {}; // roomId -> { ownerId, maxPlayers, laps, password, players: Map<socketId, name> }

io.on('connection', (socket) => {
    console.log('有玩家连接:', socket.id);
    socket.data.name = 'Guest';

    socket.on('login', (data) => {
        console.log('玩家登录:', data.username);
        socket.data.name = data.username || 'Guest';
    });

    // 创建房间
    socket.on('room:create', (info) => {
        const roomId = info.roomId;
        if (!roomId) {
            return socket.emit('room:error', '房间名不能为空');
        }
        if (rooms[roomId]) {
            return socket.emit('room:error', '房间已存在');
        }
        const maxPlayers = Math.max(2, Math.min(8, info.maxPlayers || 4));
        const laps = info.laps || 3;
        const password = info.password || '';

        rooms[roomId] = {
            ownerId: socket.id,
            maxPlayers,
            laps,
            password,
            players: new Map()
        };
        rooms[roomId].players.set(socket.id, info.name || socket.data.name || 'Guest');

        socket.join(roomId);
        console.log('房间创建:', roomId);

        broadcastRoomUpdate(roomId);
    });

    // 加入房间
    socket.on('room:join', (info) => {
        const roomId = info.roomId;
        const room = rooms[roomId];
        if (!room) {
            return socket.emit('room:error', '房间不存在');
        }
        if (room.password && room.password !== (info.password || '')) {
            return socket.emit('room:error', '密码错误');
        }
        if (room.players.size >= room.maxPlayers) {
            return socket.emit('room:error', '房间人数已满');
        }

        room.players.set(socket.id, info.name || socket.data.name || 'Guest');
        socket.join(roomId);
        console.log('玩家加入房间:', roomId, socket.id);

        broadcastRoomUpdate(roomId);
    });

    // 开始比赛（只有房主可发起）
    socket.on('race:start', (info) => {
        const roomId = info.roomId;
        const room = rooms[roomId];
        if (!room) return;
        if (room.ownerId !== socket.id) return;

        const players = Array.from(room.players.entries()).map(([id, name], idx) => ({
            id,
            name,
            slot: idx   // 用这个 slot 来安排起跑位置
        }));

        io.to(roomId).emit('race:start', {
            roomId,
            laps: room.laps,
            players
        });
        console.log('房间比赛开始:', roomId);
    });

    // 位置同步
    socket.on('race:pos', (data) => {
        const roomId = data.roomId;
        if (!roomId || !rooms[roomId]) return;
        // 转发给同房间其他玩家
        socket.to(roomId).emit('race:pos', {
            id: socket.id,
            x: data.x,
            y: data.y,
            a: data.a,
            progress: data.progress,
            lap: data.lap
        });
    });

    // 断线 / 离开房间
    socket.on('disconnect', () => {
        console.log('玩家断开:', socket.id);
        leaveAllRooms(socket);
    });
});

function broadcastRoomUpdate(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const playersArr = Array.from(room.players.entries()).map(([id, name]) => ({
        id, name
    }));

    io.to(roomId).emit('room:update', {
        roomId,
        ownerId: room.ownerId,
        maxPlayers: room.maxPlayers,
        laps: room.laps,
        players: playersArr
    });
}

function leaveAllRooms(socket) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.players.has(socket.id)) {
            room.players.delete(socket.id);
            socket.leave(roomId);
            console.log('玩家离开房间:', roomId, socket.id);

            if (room.players.size === 0) {
                delete rooms[roomId];
                console.log('房间已删除:', roomId);
            } else {
                // 如果房主走了，把房主权转给任意一个剩下的玩家
                if (room.ownerId === socket.id) {
                    const first = room.players.keys().next().value;
                    room.ownerId = first;
                    console.log('房主变更:', roomId, first);
                }
                broadcastRoomUpdate(roomId);
            }
        }
    }
}
// 连接 MongoDB
mongoose.connect('mongodb+srv://admin:Guo10160308@cluster0.imulmww.mongodb.net/?appName=Cluster0')
    .then(() => console.log('MongoDB 连接成功'))
    .catch(err => console.error('MongoDB 连接失败:', err));

// 定义排行榜模型
const LeaderboardSchema = new mongoose.Schema({
    name: String,
    lap: Number,
    s1: Number,
    s2: Number,
    s3: Number,
    date: { type: Date, default: Date.now }
});
const Record = mongoose.model('Record', LeaderboardSchema);

// ================= 排行榜接口 =================

// 获取排行榜（前端用 GET /api/leaderboard）
app.get('/api/leaderboard', async (req, res) => {
    try {
        const data = await Record.find().sort({ lap: 1 }).limit(50);
        res.json(data);
    } catch (err) {
        console.error('获取排行榜失败:', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// 提交成绩（前端用 POST /api/leaderboard）
app.post('/api/leaderboard', async (req, res) => {
    try {
        const { name, lap, s1, s2, s3 } = req.body;

        if (!name || !lap) {
            return res.status(400).json({ error: 'invalid_params' });
        }

        let existing = await Record.findOne({ name });
        if (existing) {
            // 只在新的圈速更快时更新
            if (lap < existing.lap) {
                existing.lap = lap;
                existing.s1 = s1;
                existing.s2 = s2;
                existing.s3 = s3;
                await existing.save();
            }
        } else {
            await Record.create({ name, lap, s1, s2, s3 });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('保存成绩失败:', err);
        res.status(500).json({ error: 'server_error' });
    }
});
app.delete('/api/leaderboard/:name', async (req, res) => {
    try {
        const name = req.params.name;
        if (!name) {
            return res.status(400).json({ error: 'invalid_name' });
        }
        await Record.deleteOne({ name });
        res.json({ success: true });
    } catch (err) {
        console.error('清空 PB 失败:', err);
        res.status(500).json({ error: 'server_error' });
    }
});
// =================================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


