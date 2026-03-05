// 初始化資料結構與變數
let tasks = [];
const taskListContainer = document.getElementById('task-list');
const timelineContainer = document.getElementById('timeline-list');
const nextTaskSection = document.getElementById('next-task-section');
const nextTaskDisplay = document.getElementById('next-task-display');

// 日期處理函數
function getFormatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const todayStr = getFormatDateStr(new Date());
let selectedDate = todayStr;

// 初始化日期選擇器
function initDateSelector() {
    const selector = document.getElementById('date-selector');
    if (!selector) return;
    selector.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = getFormatDateStr(d);

        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayName = i === 0 ? '今日' : dayNames[d.getDay()];

        const btn = document.createElement('div');
        btn.className = `date-btn ${dateStr === selectedDate ? 'active' : ''}`;
        btn.onclick = () => {
            selectedDate = dateStr;
            document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAll();
        };

        btn.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${d.getDate()}</div>
        `;
        selector.appendChild(btn);
    }
}

// 載入資料
function loadTasks() {
    chrome.storage.local.get(['tasks'], (result) => {
        if (result.tasks) {
            tasks = result.tasks;

            // 可選的清理機制：刪除超過 14 天的舊任務來節省空間
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const cutoffDateStr = getFormatDateStr(twoWeeksAgo);

            tasks = tasks.filter(task => {
                const taskDate = task.targetDate || (task.createdAt ? getFormatDateStr(new Date(task.createdAt)) : todayStr);
                return taskDate >= cutoffDateStr;
            });
            saveTasks();
        }
        initDateSelector();
        renderAll();
    });
}

// 儲存資料
function saveTasks() {
    chrome.storage.local.set({ tasks: tasks }, () => {
        renderAll();
    });
}

// 事件綁定：新增任務
document.getElementById('add-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('task-input');
    const timeInput = document.getElementById('task-time');

    const title = titleInput.value.trim();
    const time = timeInput.value;

    if (title) {
        const newTask = {
            id: Date.now().toString(),
            title: title,
            time: time || null, // 若未填寫時間則為 null
            completed: false,
            createdAt: new Date().toISOString(),
            targetDate: selectedDate // 新增屬性：這筆任務隸屬於哪一天
        };

        tasks.push(newTask);
        saveTasks();

        // 清空輸入框
        titleInput.value = '';
        timeInput.value = '';
        titleInput.focus();
    }
});

// 切換頁籤邏輯
const tabs = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view-section');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // 移除現有 active
        tabs.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));

        // 加上新的 active
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab') + '-view';
        document.getElementById(targetId).classList.add('active');
    });
});

// 統一渲染入口
function renderAll() {
    renderTodoList();
    renderTimeline();
    updateNextTask();
}

// 取得當前所選日期的任務
function getSelectedDateTasks() {
    return tasks.filter(t => {
        const tDate = t.targetDate || todayStr;
        if (selectedDate === todayStr) {
            // 如果是在看「今天」，則連同過去「未完成」的任務一併顯示
            if (tDate === todayStr) return true;
            if (tDate < todayStr && !t.completed) return true;
            return false;
        } else {
            // 如果看的是未來某一天，只顯示那一天的
            return tDate === selectedDate;
        }
    });
}

// 渲染：待辦清單
function renderTodoList() {
    taskListContainer.innerHTML = '';
    const dayTasks = getSelectedDateTasks();

    if (dayTasks.length === 0) {
        taskListContainer.innerHTML = '<div class="empty-state">目前沒有任何任務，請在下方新增！</div>';
        return;
    }

    // 排序：未完成在前，已完成在後；同狀態依時間或建立順序排序
    const sortedTasks = [...dayTasks].sort((a, b) => {
        if (a.completed === b.completed) {
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return b.id - a.id;
        }
        return a.completed ? 1 : -1;
    });

    sortedTasks.forEach(task => {
        const taskEl = document.createElement('div');
        const taskDate = task.targetDate || todayStr;
        const isPastOverdue = taskDate < todayStr && !task.completed;

        let timeDisplay = task.time ? `🕒 ${task.time}` : '隨時';
        if (isPastOverdue) {
            timeDisplay = `⚠️ 延遲自 ${taskDate} ${task.time || ''}`;
        }

        taskEl.className = `task-item ${task.completed ? 'completed' : ''} ${isPastOverdue ? 'past-overdue' : ''}`;

        taskEl.innerHTML = `
      <div class="task-checkbox-container" data-id="${task.id}">
        <div class="custom-checkbox"></div>
      </div>
      <div class="task-details">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          <span>${timeDisplay}</span>
        </div>
      </div>
      <button class="task-delete" data-id="${task.id}">刪除</button>
    `;

        taskListContainer.appendChild(taskEl);
    });

    // 綁定待辦事件 (完成 / 刪除)
    document.querySelectorAll('.task-checkbox-container').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            toggleTaskComplete(id);
        });
    });

    document.querySelectorAll('.task-delete').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            deleteTask(id);
        });
    });
}

// 渲染：時間軸 (只顯示有設定時間的項目，依照時間順序)
function renderTimeline() {
    timelineContainer.innerHTML = '';

    const dayTasks = getSelectedDateTasks();
    const timedTasks = dayTasks.filter(t => t.time).sort((a, b) => a.time.localeCompare(b.time));

    if (timedTasks.length === 0) {
        timelineContainer.innerHTML = '<div class="empty-state">尚未安排有明確時間的行程。新增任務時請指定時間即可在這裡看見。</div>';
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = selectedDate === todayStr;

    timedTasks.forEach(task => {
        const [hours, minutes] = task.time.split(':').map(Number);
        const taskMinutes = hours * 60 + minutes;
        const taskDate = task.targetDate || todayStr;
        const isPastOverdue = taskDate < todayStr && !task.completed;

        let timeStatusClass = '';
        // 如果是今天，且時間已經過且未完成，標記為逾期; 或者過去未完成也是逾期
        if ((isToday && taskMinutes < currentMinutes && !task.completed) || isPastOverdue) {
            timeStatusClass = 'overdue';
        }

        const itemEl = document.createElement('div');
        itemEl.className = `timeline-item ${task.completed ? 'completed' : ''} ${timeStatusClass}`;

        itemEl.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-time">${task.time}</div>
        <div class="task-title">${escapeHTML(task.title)}</div>
      </div>
    `;

        timelineContainer.appendChild(itemEl);
    });
}

// 計算「下一個任務」邏輯：提示永遠考慮「今天」與「過去未完成」的任務
function updateNextTask() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. 取得「今日」與「過去」所有未完成的任務
    const pendingTasks = tasks.filter(t => {
        if (t.completed) return false;
        const tDate = t.targetDate || todayStr;
        return tDate <= todayStr;
    });

    if (pendingTasks.length === 0) {
        nextTaskDisplay.textContent = '今日任務已全數完成！';
        nextTaskSection.classList.remove('active');
        return;
    }

    // 2. 篩選有時間的，算出差異
    let nextTimedTask = null;
    let minDiff = Infinity;
    let hasOverdue = false;

    const timedPending = pendingTasks.filter(t => t.time);
    timedPending.forEach(t => {
        const [h, m] = t.time.split(':').map(Number);
        const taskMin = h * 60 + m;
        const taskDate = t.targetDate || todayStr;
        const diff = taskMin - currentMinutes;

        // 如果任務是過去的，或是今天的時間已過
        if (taskDate < todayStr || diff < 0) {
            hasOverdue = true;
        } else if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            nextTimedTask = t;
        }
    });

    // 決定顯示哪一個
    let targetTask = null;
    let warningMode = false;

    if (hasOverdue) {
        const firstOverdue = pendingTasks.find(t => {
            const taskDate = t.targetDate || todayStr;
            if (taskDate < todayStr) return true; // 跨日逾期優先
            if (!t.time) return false;
            const [h, m] = t.time.split(':').map(Number);
            return (h * 60 + m) - currentMinutes < 0;
        });
        targetTask = firstOverdue;
        warningMode = true;
        nextTaskDisplay.innerHTML = `<span style="color:var(--danger-color)">[延遲]</span> ${escapeHTML(targetTask.title)}`;
    } else if (nextTimedTask) {
        targetTask = nextTimedTask;
        warningMode = minDiff <= 30; // 30 分鐘內變紅點警告
        nextTaskDisplay.innerHTML = `<span>${targetTask.time}</span> - ${escapeHTML(targetTask.title)}`;
    } else {
        const noTimeTask = pendingTasks.find(t => !t.time);
        targetTask = noTimeTask;
        warningMode = false;
        nextTaskDisplay.innerHTML = `${escapeHTML(targetTask.title)}`;
    }

    if (warningMode) {
        nextTaskSection.classList.add('active');
    } else {
        nextTaskSection.classList.remove('active');
    }
}

// 操作函數
function toggleTaskComplete(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        tasks[index].completed = !tasks[index].completed;
        saveTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
}

// 基礎 HTML 脫逸防止 XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// 每當有本地存儲改變時更新
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.tasks && namespace === 'local') {
        const newTasks = changes.tasks.newValue;
        // 簡單比對以避免重複無謂的渲染迴圈（如果是我自己觸發的就不重整）
        if (JSON.stringify(newTasks) !== JSON.stringify(tasks)) {
            tasks = newTasks || [];
            renderAll();
        }
    }
});

// 監聽來自 background 的關閉指令 (用來達成點擊第二下按鈕時關閉側邊欄)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "closeYourself") {
        window.close();
    }
});

// 當側邊欄被手動關閉 (如點選右上角 X) 時，通知 background 更新狀態
window.addEventListener('beforeunload', () => {
    // 試著取得目前 tabId，如果是在獨立視窗可能會拿不到，但盡量傳送
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
            chrome.runtime.sendMessage({ action: "sidePanelClosedManually", tabId: tabs[0].id });
        }
    });
});

// 每分鐘自動更新一次 UI
setInterval(renderAll, 60000);

// 初次載入
loadTasks();
