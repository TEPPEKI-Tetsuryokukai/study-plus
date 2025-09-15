// 変数定義
let timerInterval;
let startTime;
let elapsedTime = 0;
let isRunning = false;
let weeklyChart, subjectChart;
let currentUser = null;
let deferredPrompt; // PWAインストール用

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    // 今日の日付を日付入力に設定
    document.getElementById('study-date').valueAsDate = new Date();
    
    // 認証タブの切り替え
    document.getElementById('login-tab').addEventListener('click', function() {
        switchAuthTab('login');
    });
    
    document.getElementById('register-tab').addEventListener('click', function() {
        switchAuthTab('register');
    });
    
    // 自動ログインの試行
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            // 簡易的な認証状態の確認（実際にはもっと複雑なチェックが必要）
            if (user && user.username) {
                currentUser = user;
                showApp();
            }
        } catch (e) {
            console.error('Error parsing saved user', e);
            localStorage.removeItem('currentUser');
        }
    }
    
    // PWAインストールプロンプトの処理
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.classList.remove('hidden');
            installButton.addEventListener('click', installApp);
        }
    });
});

// PWAインストール関数
function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
            const installButton = document.getElementById('install-button');
            if (installButton) {
                installButton.classList.add('hidden');
            }
        });
    }
}

// 認証タブの切り替え
function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    } else {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }
}

// ユーザー登録
function register() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    
    if (!username || !password) {
        alert('ユーザー名とパスワードを入力してください');
        return;
    }
    
    if (password !== confirm) {
        alert('パスワードが一致しません');
        return;
    }
    
    if (password.length < 6) {
        alert('パスワードは6文字以上で設定してください');
        return;
    }
    
    // ユーザー登録情報の取得
    const users = JSON.parse(localStorage.getItem('studyUsers') || '{}');
    
    if (users[username]) {
        alert('このユーザー名は既に使用されています');
        return;
    }
    
    // パスワードのハッシュ化（SHA256）
    const hashedPassword = CryptoJS.SHA256(password).toString();
    
    // ユーザー情報の保存
    users[username] = {
        password: hashedPassword,
        createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('studyUsers', JSON.stringify(users));
    
    // ユーザーデータの初期化
    const userData = {
        records: [],
        settings: {}
    };
    
    localStorage.setItem(`userData_${username}`, JSON.stringify(userData));
    
    alert('ユーザー登録が完了しました。ログインしてください。');
    switchAuthTab('login');
}

// ログイン
function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert('ユーザー名とパスワードを入力してください');
        return;
    }
    
    // ユーザー情報の取得
    const users = JSON.parse(localStorage.getItem('studyUsers') || '{}');
    
    if (!users[username]) {
        alert('ユーザー名またはパスワードが正しくありません');
        return;
    }
    
    // パスワードの検証
    const hashedPassword = CryptoJS.SHA256(password).toString();
    
    if (users[username].password !== hashedPassword) {
        alert('ユーザー名またはパスワードが正しくありません');
        return;
    }
    
    // ログイン成功
    currentUser = {
        username: username,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showApp();
}

// ログアウト
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    hideApp();
    resetTimer();
    
    // フォームをクリア
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm').value = '';
}

// アプリ表示の切り替え
function showApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('stats-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('weekly-chart-section').classList.remove('hidden');
    document.getElementById('subject-chart-section').classList.remove('hidden');
    document.getElementById('history-section').classList.remove('hidden');
    
    document.getElementById('username-display').textContent = currentUser.username;
    
    // グラフの初期化
    initCharts();
    
    // 記録の読み込みと表示
    loadRecords();
    updateStats();
    renderRecordsTable();
}

function hideApp() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('stats-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('weekly-chart-section').classList.add('hidden');
    document.getElementById('subject-chart-section').classList.add('hidden');
    document.getElementById('history-section').classList.add('hidden');
}

// タイマー機能
function startTimer() {
    if (isRunning) return;
    
    isRunning = true;
    startTime = new Date() - elapsedTime;
    
    timerInterval = setInterval(function() {
        const now = new Date();
        elapsedTime = now - startTime;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (!isRunning) return;
    
    clearInterval(timerInterval);
    isRunning = false;
}

function updateTimerDisplay() {
    const hours = Math.floor(elapsedTime / 3600000);
    const minutes = Math.floor((elapsedTime % 3600000) / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    
    document.getElementById('timer').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 記録の保存
function saveRecord() {
    if (!currentUser) {
        alert('ログインしてください');
        return;
    }
    
    if (elapsedTime === 0) {
        alert('まずは勉強を開始してください');
        return;
    }
    
    const subject = document.getElementById('subject').value.trim();
    if (!subject) {
        alert('科目名を入力してください');
        return;
    }
    
    const hours = (elapsedTime / 3600000).toFixed(2);
    const record = {
        date: new Date().toISOString().split('T')[0],
        subject: subject,
        hours: parseFloat(hours),
        notes: '計測記録',
        timestamp: new Date().toISOString()
    };
    
    addRecord(record);
    resetTimer();
    alert('記録を保存しました！');
}

function addManualRecord() {
    if (!currentUser) {
        alert('ログインしてください');
        return;
    }
    
    const subject = document.getElementById('manual-subject').value.trim();
    const date = document.getElementById('study-date').value;
    const hours = parseFloat(document.getElementById('study-hours').value);
    const notes = document.getElementById('study-notes').value.trim();
    
    if (!subject || !date || !hours) {
        alert('科目名、日付、時間は必須です');
        return;
    }
    
    if (hours <= 0) {
        alert('勉強時間は0より大きい値で入力してください');
        return;
    }
    
    const record = {
        date: date,
        subject: subject,
        hours: hours,
        notes: notes || '手動記録',
        timestamp: new Date().toISOString()
    };
    
    addRecord(record);
    
    // フォームをリセット
    document.getElementById('manual-subject').value = '';
    document.getElementById('study-hours').value = '';
    document.getElementById('study-notes').value = '';
    
    alert('記録を追加しました！');
}

function resetTimer() {
    stopTimer();
    elapsedTime = 0;
    document.getElementById('timer').textContent = '00:00:00';
    document.getElementById('subject').value = '';
}

// データ管理
function getRecords() {
    if (!currentUser) return [];
    
    const userData = JSON.parse(localStorage.getItem(`userData_${currentUser.username}`) || '{"records": []}');
    return userData.records || [];
}

function saveRecords(records) {
    if (!currentUser) return;
    
    const userData = JSON.parse(localStorage.getItem(`userData_${currentUser.username}`) || '{}');
    userData.records = records;
    localStorage.setItem(`userData_${currentUser.username}`, JSON.stringify(userData));
}

function addRecord(record) {
    const records = getRecords();
    records.push(record);
    saveRecords(records);
    loadRecords();
}

function deleteRecord(index) {
    if (!confirm('この記録を削除しますか？')) return;
    
    const records = getRecords();
    records.splice(index, 1);
    saveRecords(records);
    loadRecords();
}

function loadRecords() {
    updateStats();
    renderRecordsTable();
    updateCharts();
}

// 統計情報の更新
function updateStats() {
    const records = getRecords();
    const today = new Date().toISOString().split('T')[0];
    
    // 今日の勉強時間
    const todayTime = records
        .filter(record => record.date === today)
        .reduce((total, record) => total + record.hours, 0);
    
    // 今週の勉強時間
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekTime = records
        .filter(record => new Date(record.date) >= oneWeekAgo)
        .reduce((total, record) => total + record.hours, 0);
    
    // 合計勉強時間
    const totalTime = records.reduce((total, record) => total + record.hours, 0);
    
    // 表示を更新
    document.getElementById('today-time').textContent = `${Math.floor(todayTime)}h ${Math.round((todayTime % 1) * 60)}m`;
    document.getElementById('week-time').textContent = `${Math.floor(weekTime)}h ${Math.round((weekTime % 1) * 60)}m`;
    document.getElementById('total-time').textContent = `${Math.floor(totalTime)}h ${Math.round((totalTime % 1) * 60)}m`;
}

// テーブルのレンダリング
function renderRecordsTable() {
    const records = getRecords();
    const tableBody = document.getElementById('records-table');
    
    // 日付でソート（新しい順）
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tableBody.innerHTML = '';
    
    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">記録がありません</td></tr>';
        return;
    }
    
    records.forEach((record, index) =>{
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td>${record.subject}</td>
            <td>${record.hours.toFixed(1)}時間</td>
            <td>${record.notes}</td>
            <td class="delete-btn" onclick="deleteRecord(${index})">削除</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// グラフの初期化と更新
function initCharts() {
    const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
    const subjectCtx = document.getElementById('subjectChart').getContext('2d');
    
    weeklyChart = new Chart(weeklyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '勉強時間（時間）',
                data: [],
                backgroundColor: 'rgba(67, 97, 238, 0.5)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '時間'
                    }
                }
            }
        }
    });
    
    subjectChart = new Chart(subjectCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(67, 97, 238, 0.7)',
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(58, 12, 163, 0.7)',
                    'rgba(247, 37, 133, 0.7)',
                    'rgba(255, 200, 87, 0.7)',
                    'rgba(45, 212, 191, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
    
    updateCharts();
}

function updateCharts() {
    const records = getRecords();
    
    // 週間グラフの更新
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const dailyData = last7Days.map(date => {
        const dayRecords = records.filter(record => record.date === date);
        return dayRecords.reduce((total, record) => total + record.hours, 0);
    });
    
    weeklyChart.data.labels = last7Days.map(date => formatDate(date));
    weeklyChart.data.datasets[0].data = dailyData;
    weeklyChart.update();
    
    // 科目別グラフの更新
    const subjects = {};
    records.forEach(record => {
        if (subjects[record.subject]) {
            subjects[record.subject] += record.hours;
        } else {
            subjects[record.subject] = record.hours;
        }
    });
    
    // 科目を勉強時間の降順でソート
    const sortedSubjects = Object.entries(subjects)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6); // 最大6科目まで表示
    
    subjectChart.data.labels = sortedSubjects.map(item => item[0]);
    subjectChart.data.datasets[0].data = sortedSubjects.map(item => item[1]);
    subjectChart.update();
}

// ユーティリティ関数
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}
