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

// 获取排行榜接口
app.post('/api/leaderboard', async (req, res) => {
  const { name, lap, s1, s2, s3 } = req.body;
  const existing = await Record.findOne({ name });
  if (existing) {
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
});

// 提交成绩接口
app.post('/api/leaderboard', async (req, res) => {
    const { name, lap, s1, s2, s3 } = req.body;
    try {
        let existing = await Record.findOne({ name });
        if (existing) {
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
        res.send({ success: true });
    } catch (err) {
        res.status(500).send(err);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

