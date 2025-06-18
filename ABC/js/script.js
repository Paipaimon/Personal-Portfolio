let searchHistory = [];
let searchCount = 0;

function change() {
    const input = document.querySelector('#value');
    const output = document.querySelector('#text');
    const clearBtn = document.querySelector('#clearBtn');
    const stats = document.querySelector('#stats');
    const value = input.value.trim();
    
    if (value.length === 0) {
        output.innerHTML = `
            <div style="text-align: center; color: #718096;">
                <p>💡 在上方输入缩写划词查看解释</p>
                <p style="font-size: 16px; margin-top: 10px;">支持常见网络用语、英文缩写等</p>
            </div>
        `;
        output.classList.remove('has-content');
        clearBtn.style.display = 'none';
        updateStats();
        return;
    }
    
    // 显示清空按钮
    clearBtn.style.display = 'inline-block';
    output.classList.add('has-content');
    
    // 记录搜索历史
    if (!searchHistory.includes(value.toUpperCase())) {
        searchHistory.push(value.toUpperCase());
        searchCount++;
    }
    
    // 显示搜索结果
    const upperValue = value.toUpperCase();
    output.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #4a5568; margin: 0 0 15px 0; font-size: 24px;">🔍 搜索结果</h3>
            <div style="background: #e6fffa; padding: 15px; border-radius: 10px; border-left: 4px solid #38b2ac;">
                <p style="margin: 0; font-size: 22px; font-weight: bold; color: #2d3748;">输入内容: <span style="color: #38b2ac;">${upperValue}</span></p>
            </div>
        </div>
        <div style="background: #f7fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <h4 style="margin: 0 0 10px 0; color: #4a5568;">💡 使用提示:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #718096; font-size: 16px;">
                <li>支持英文缩写查询</li>
                <li>常见网络用语: LOL, OMG, WTF, LMAO等</li>
                <li>技术缩写: API, URL, HTML, CSS等</li>
                <li>页面已集成第三方解释服务</li>
            </ul>
        </div>
    `;
    
    updateStats();
}

function clearInput() {
    const input = document.querySelector('#value');
    const output = document.querySelector('#text');
    const clearBtn = document.querySelector('#clearBtn');
    
    input.value = '';
    input.focus();
    change();
}

function updateStats() {
    const stats = document.querySelector('#stats');
    if (searchHistory.length > 0) {
        stats.innerHTML = `
            📊 已搜索 ${searchCount} 个缩写 | 
            🕒 最近搜索: ${searchHistory.slice(-3).join(', ')}
        `;
    } else {
        stats.innerHTML = '';
    }
}

// 添加键盘快捷键支持
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.querySelector('#value').focus();
    }
    if (e.key === 'Escape') {
        clearInput();
    }
});

// 页面加载完成后聚焦输入框
window.addEventListener('load', function() {
    document.querySelector('#value').focus();
});