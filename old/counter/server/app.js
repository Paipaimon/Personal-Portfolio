const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 连接MongoDB
// 修改MongoDB连接字符串，添加用户名和密码
mongoose.connect('mongodb://mongo_GGSmf2:mongo_5pntpY@8.137.20.13:27017/counter_game', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin' // 指定认证数据库
})
.then(() => console.log('MongoDB连接成功'))
.catch(err => console.error('MongoDB连接失败:', err));

// 创建分数模型
const ScoreSchema = new mongoose.Schema({
    playerName: {
        type: String,
        required: true,
        trim: true
    },
    score: {
        type: Number,
        required: true
    },
    timeSpent: {
        type: Number,
        required: true
    },
    correctCount: {
        type: Number,
        required: true
    },
    totalRounds: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Score = mongoose.model('Score', ScoreSchema);

// 保存分数接口
app.post('/counter/save-score', async (req, res) => {
    try {
        const { playerName, score, timeSpent, correctCount, totalRounds } = req.body;
        
        // 验证数据
        if (!playerName || typeof score !== 'number' || typeof timeSpent !== 'number') {
            return res.status(400).json({ error: '数据格式不正确' });
        }
        
        // 创建新分数记录
        const newScore = new Score({
            playerName,
            score,
            timeSpent,
            correctCount,
            totalRounds
        });
        
        // 保存到数据库
        await newScore.save();
        
        res.status(201).json({ 
            message: '分数保存成功',
            score: newScore
        });
    } catch (error) {
        console.error('保存分数出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 获取排行榜接口
app.get('/counter/leaderboard', async (req, res) => {
    try {
        // 获取前10名最高分
        const leaderboard = await Score.find()
            .sort({ score: -1 }) // 按分数降序排序
            .limit(10)
            .select('playerName score timeSpent correctCount createdAt');
        
        res.json(leaderboard);
    } catch (error) {
        console.error('获取排行榜出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});
// 获取当天排行榜接口
app.get('/counter/today-leaderboard', async (req, res) => {
    try {
        // 获取今天的开始时间（当地时区的00:00:00）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 获取今天结束时间（当地时区的23:59:59）
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // 获取当天前10名最高分
        const leaderboard = await Score.find({
            createdAt: {
                $gte: today,
                $lt: tomorrow
            }
        })
        .sort({ score: -1 }) // 按分数降序排序
        .limit(10)
        .select('playerName score timeSpent correctCount createdAt');
        
        res.json(leaderboard);
    } catch (error) {
        console.error('获取排行榜出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});
// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});