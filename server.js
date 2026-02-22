const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose'); // 必须加这一行！

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});
app.use(express.json());
app.use(express.static('public'));
io.on('connection', (socket) => {
    console.log('有玩家连接了:', socket.id);
    
    socket.on('login', (data) => {
        console.log('玩家登录:', data.username);
        // 这里写你的 MongoDB 查询逻辑
    });
});
// 1. 连接到你的远程数据库（把下面的地址换成你申请到的）
mongoose.connect('mongodb+srv://admin:Guo10160308@cluster0.imulmww.mongodb.net/?appName=Cluster0');
// 2. 定义排行榜的数据结构
const LeaderboardSchema = new mongoose.Schema({
    name: String,
    lap: Number,
    s1: Number, s2: Number, s3: Number,
    date: { type: Date, default: Date.now }
});
const Record = mongoose.model('Record', LeaderboardSchema);

// 3. 获取排行榜 API
app.get('/api/leaderboard', async (req, res) => {
    // 从数据库查前 50 名，按时间从小到大排
    const data = await Record.find().sort({ lap: 1 }).limit(50);
    res.json(data);
});

// 4. 提交成绩 API
app.post('/api/leaderboard', async (req, res) => {
    const { name, lap, s1, s2, s3 } = req.body;
    
    // 查找该玩家是否已有记录
    const existing = await Record.findOne({ name });
    if (existing) {
        if (lap < existing.lap) { // 如果新成绩更好，就更新
            existing.lap = lap;
            existing.s1 = s1; existing.s2 = s2; existing.s3 = s3;
            await existing.save();
        }
    } else {
        await Record.create({ name, lap, s1, s2, s3 });
    }
    res.send({ success: true });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});





