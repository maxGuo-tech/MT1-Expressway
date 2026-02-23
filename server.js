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

io.on('connection', (socket) => {
    console.log('有玩家连接:', socket.id);

    socket.on('login', (data) => {
        console.log('玩家登录:', data.username);
        // 这里暂时只记个名，之后你想做账号系统再改
    });
});

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

