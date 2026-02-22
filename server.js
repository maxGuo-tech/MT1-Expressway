const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public')); // 游戏文件放在 public 文件夹里

let users = {}; // 模拟数据库存用户信息 { username: { pass, pb } }

io.on('connection', (socket) => {
    // 处理登录/注册
    socket.on('auth', (data) => {
        if (data.isReg) {
            if (users[data.user]) return socket.emit('authRes', { ok: false, msg: "用户名已存在" });
            users[data.user] = { pass: data.pass, pb: { lap: 1e9, s1:0, s2:0, s3:0 } };
            socket.emit('authRes', { ok: true, user: data.user, pb: users[data.user].pb });
        } else {
            let u = users[data.user];
            if (u && u.pass === data.pass) socket.emit('authRes', { ok: true, user: data.user, pb: u.pb });
            else socket.emit('authRes', { ok: false, msg: "密码错误或用户不存在" });
        }
    });

    // 提交新纪录
    socket.on('submitPB', (data) => {
        if (users[data.user]) {
            users[data.user].pb = data.pb;
        }
    });

    // 获取排行榜
    socket.on('getLeaderboard', () => {
        let lb = Object.keys(users).map(name => ({ name, pb: users[name].pb }))
                 .filter(u => u.pb.lap < 1e9)
                 .sort((a, b) => a.pb.lap - b.pb.lap).slice(0, 10);
        socket.emit('leaderboardUpdate', lb);
    });
});

http.listen(3000, () => console.log('网站已启动: http://localhost:3000'));