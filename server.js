const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
// 假设你的前端 HTML 放在 /app/public 目录下
app.use(express.static('/app/public'));

// 存储排行榜数据的文件路径
const DB_PATH = '/app/data/leaderboard.json';
let leaderboard = [];

// 启动时读取现有的排行榜
if (fs.existsSync(DB_PATH)) {
    leaderboard = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
} else {
    // 确保目录存在
    fs.mkdirSync('/app/data', { recursive: true });
}

// 接口：获取全局排行榜
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboard);
});

// 接口：上传新成绩 (PB)
app.post('/api/leaderboard', (req, res) => {
    const { name, lap, s1, s2, s3 } = req.body;
    
    if (!name || !lap) return res.status(400).send('Invalid data');

    // 检查玩家是否已经在榜单上
    const existingIndex = leaderboard.findIndex(p => p.name === name);
    if (existingIndex !== -1) {
        // 如果新成绩更好，则更新
        if (lap < leaderboard[existingIndex].lap) {
            leaderboard[existingIndex] = { name, lap, s1, s2, s3 };
        }
    } else {
        // 新玩家，直接加入
        leaderboard.push({ name, lap, s1, s2, s3 });
    }

    // 按圈速时间从小到大排序 (跑得越快越靠前)
    leaderboard.sort((a, b) => a.lap - b.lap);
    // 只保留前 50 名
    leaderboard = leaderboard.slice(0, 50);

    // 持久化保存到文件
    fs.writeFileSync(DB_PATH, JSON.stringify(leaderboard));
    
    res.send({ success: true });
});

app.listen(3000, () => console.log('Server running on port 3000'));
