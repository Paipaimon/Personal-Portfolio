
const screen = document.getElementById('screen');
const info = document.getElementById('info');
const result = document.getElementById('result');
const startBtn = document.getElementById('start-btn');
const keys = document.querySelectorAll('.key');

let currentRound = 0;
const totalRounds = 10;
let correctCount = 0;
let startTime;
let endTime;
let currentBallCount = 0;

// 开始游戏
startBtn.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
    if (e.key == 0) {
        startGame();
    }
});

// 键盘事件
document.addEventListener('keydown', function (e) {
    if (currentRound === 0 || currentRound > totalRounds) return;
    const key = parseInt(e.key);
    if (key >= 1 && key <= 9) {
        checkAnswer(key);
    }
});

// 鼠标点击键盘
keys.forEach(key => {
    key.addEventListener('click', function () {
        if (currentRound === 0 || currentRound > totalRounds) return;

        const number = parseInt(this.getAttribute('data-number'));
        checkAnswer(number);
    });
});

function startGame() {
    currentRound = 1;
    correctCount = 0;
    startTime = new Date();
    result.textContent = '';
    screen.className = ''; // 清除反馈样式
    generateBalls();
}

function generateBalls() {
    screen.innerHTML = '';
    currentBallCount = Math.floor(Math.random() * 9) + 1;

    const screenWidth = screen.clientWidth;
    const screenHeight = screen.clientHeight;
    const ballSize = 50;
    const balls = [];

    // 生成不重叠的小球
    for (let i = 0; i < currentBallCount; i++) {
        const ball = document.createElement('div');
        ball.className = 'ball';

        let attempts = 0;
        let positionFound = false;

        // 尝试最多100次找到一个不重叠的位置
        while (!positionFound && attempts < 100) {
            attempts++;

            // 随机位置，确保球完全在屏幕内
            const maxX = screenWidth - ballSize;
            const maxY = screenHeight - ballSize;
            const randomX = Math.floor(Math.random() * maxX);
            const randomY = Math.floor(Math.random() * maxY);

            // 检查是否与现有球重叠
            let overlap = false;
            for (const existingBall of balls) {
                const dx = existingBall.x - randomX;
                const dy = existingBall.y - randomY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ballSize * 1.2) { // 1.2倍直径作为安全距离
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                ball.style.left = `${randomX}px`;
                ball.style.top = `${randomY}px`;
                screen.appendChild(ball);

                // 记录球的位置
                balls.push({
                    x: randomX,
                    y: randomY
                });

                positionFound = true;
            }
        }

        // 如果100次尝试后仍找不到位置，强制放置
        if (!positionFound) {
            const randomX = Math.floor(Math.random() * (screenWidth - ballSize));
            const randomY = Math.floor(Math.random() * (screenHeight - ballSize));
            ball.style.left = `${randomX}px`;
            ball.style.top = `${randomY}px`;
            screen.appendChild(ball);
        }
    }

    info.textContent = `第 ${currentRound} 轮/共 ${totalRounds} 轮 - 请选择小球数量`;
}

function checkAnswer(answer) {
    // 清除之前的反馈
    screen.classList.remove('correct-screen', 'incorrect-screen');

    if (answer === currentBallCount) {
        correctCount++;
        screen.classList.add('correct-screen');
    } else {
        screen.classList.add('incorrect-screen');
    }
    // 添加键盘输入反馈
    const keyElement = document.querySelector(`.key[data-number="${answer}"]`);
    if (keyElement) {
        keyElement.style.backgroundColor = answer === currentBallCount ? '#2ecc71' : '#e74c3c';
        setTimeout(() => {
            keyElement.style.backgroundColor = '#e0e0e0';
        }, 200); // 0.2秒后恢复
    }
    currentRound++;
    if (currentRound <= totalRounds) {
        generateBalls();
    } else {
        endGame();
    }
}

function endGame() {
    endTime = new Date();
    const timeSpent = (endTime - startTime) / 1000; // 秒

    // 计算得分 (正确率 * 时间系数)
    const accuracy = correctCount / totalRounds;
    // 时间系数 - 基准是30秒 (30秒得1分，每少0.1秒加0.02，每多0.1秒减0.02)
    const timeDifference = (30 - timeSpent) * 10; // 转换为0.1秒单位
    const timeFactor = 1 + (timeDifference * 0.02);
    // 确保时间系数不小于0.5
    const adjustedTimeFactor = Math.max(0.5, timeFactor);

    const score = Math.round(accuracy * 100 * adjustedTimeFactor);

    result.innerHTML = `
        <p>游戏结束!</p>
        <p>正确次数: ${correctCount}/${totalRounds}</p>
        <p>用时: ${timeSpent.toFixed(2)} 秒</p>
        <p>最终得分: ${score}</p>
        <div style="margin-top: 15px;">
            <input type="text" id="player-name" placeholder="输入你的名字" style="padding: 5px; width: 150px;">
            <button id="save-score" style="padding: 5px 10px; background-color: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">提交成绩</button>
        </div>
    `;

    // 添加保存分数的事件监听
    document.getElementById('save-score').addEventListener('click', function() {
        const playerName = document.getElementById('player-name').value.trim() || '匿名玩家';
        saveScore(playerName, score, timeSpent);
        this.disabled = true;
        this.textContent = '已提交';
    });

    currentRound = 0;
    info.textContent = '点击"开始游戏"按钮重新开始';
    
    // 获取排行榜数据
    fetchLeaderboard();
}

// 保存分数到后端
function saveScore(playerName, score, timeSpent) {
    // 创建要发送的数据对象
    const scoreData = {
        playerName: playerName,
        score: score,
        timeSpent: timeSpent,
        correctCount: correctCount,
        totalRounds: totalRounds
    };
    
    // 发送数据到后端API
    fetch('https://api.jlands.cn/counter/save-score', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(scoreData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('网络错误');
        }
        return response.json();
    })
    .then(data => {
        console.log('分数保存成功:', data);
        // 更新排行榜
        fetchLeaderboard();
    })
    .catch(error => {
        console.error('保存分数出错:', error);
        alert('保存分数失败，请稍后再试');
    });
}

// 从后端获取排行榜数据
function fetchLeaderboard() {
    fetch('https://api.jlands.cn/counter/leaderboard')
    .then(response => {
        if (!response.ok) {
            throw new Error('网络错误');
        }
        return response.json();
    })
    .then(data => {
        displayLeaderboard(data);
    })
    .catch(error => {
        console.error('获取排行榜出错:', error);
        document.getElementById('leaderboard-body').innerHTML = 
            '<tr><td colspan="5" style="text-align:center;padding:10px;">获取排行榜失败，请稍后再试</td></tr>';
    });
}

// 显示排行榜
function displayLeaderboard(leaderboardData) {
    const leaderboardBody = document.getElementById('leaderboard-body');
    
    // 清空现有排行榜
    leaderboardBody.innerHTML = '';
    
    // 如果没有数据
    if (!leaderboardData || leaderboardData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" style="text-align:center;padding:10px;">暂无数据</td>';
        leaderboardBody.appendChild(row);
        return;
    }
    
    // 填充排行榜数据
    leaderboardData.forEach((entry, index) => {
        const row = document.createElement('tr');
        // 前三名使用特殊背景色
        row.style.backgroundColor = index < 3 ? '#f9f9c6' : 'white';
        
        // 格式化日期
        const date = new Date(entry.createdAt);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        
        row.innerHTML = `
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${entry.playerName}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${entry.score}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${entry.timeSpent.toFixed(2)}秒</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${formattedDate}</td>
        `;
        
        leaderboardBody.appendChild(row);
    });
}

// 页面加载时获取排行榜
window.addEventListener('load', function() {
    fetchLeaderboard();
});
