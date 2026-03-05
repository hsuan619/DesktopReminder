// 創建懸浮按鈕的 DOM 元素
const createAssistiveTouchBtn = () => {
    if (document.getElementById('assistive-touch-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'assistive-touch-btn';
    btn.innerHTML = `
        <div class="at-inner-circle">
            <div class="at-core-dot"></div>
        </div>
        <div class="at-notification-badge" id="at-badge"></div>
    `;

    document.body.appendChild(btn);

    // ======== 拖曳功能實作 ========
    let isDragging = false;
    let hasMoved = false;
    let startX, startY;
    let offsetX, offsetY;

    btn.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        offsetX = e.clientX - btn.getBoundingClientRect().left;
        offsetY = e.clientY - btn.getBoundingClientRect().top;
        btn.classList.add('is-dragging');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // 加入移動閥值，避免手稍微抖動就被判定為拖曳而關閉點擊事件
        if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
            hasMoved = true;
        }

        if (hasMoved) {
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            const maxX = window.innerWidth - btn.offsetWidth;
            const maxY = window.innerHeight - btn.offsetHeight;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            btn.style.left = `${newX}px`;
            btn.style.top = `${newY}px`;
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            btn.classList.remove('is-dragging');
        }
    });

    // ======== 點擊開啟側邊欄 ========
    btn.addEventListener('click', (e) => {
        if (hasMoved) return; // 的確是拖曳，忽略點擊

        try {
            chrome.runtime.sendMessage({ action: "openSidePanel" });
        } catch (error) {
            if (error.message && error.message.includes("Extension context invalidated")) {
                alert("AssistiveTouch 擴充功能已經在背景更新！\n\n為了讓小圓點能繼續運作，請「重新整理 (F5)」您正在瀏覽的這個網頁。");
            } else {
                console.error("AssistiveTouch Error:", error);
            }
        }
    });

    // 首次執行更新紅點
    updateBadgeStatus();
};

// ==========================================
// 紅點狀態同步
// ==========================================
function updateBadgeStatus() {
    chrome.storage.local.get(['tasks'], (result) => {
        const badge = document.getElementById('at-badge');
        if (!badge || !result.tasks) return;

        let showBadge = false;
        const tasks = result.tasks || [];
        const pendingTasks = tasks.filter(t => !t.completed);
        const timedPending = pendingTasks.filter(t => t.time);

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // 如果這個任務不是今天的，不該有紅點，但因為目前系統還沒改版成未來七天，
        // 這裡暫時只用 currentMinutes。之後改版成 7 天後，這裡也要加上日期判斷。

        timedPending.forEach(t => {
            const [h, m] = t.time.split(':').map(Number);
            const taskMinutes = h * 60 + m;
            const diff = taskMinutes - currentMinutes;

            // 任務時間已過 (diff < 0) 或 30 分鐘內即將到來 (0 <= diff <= 30)
            if (diff <= 10) {
                // 但要先過濾掉那些「跨天」或者是非常久遠的任務嗎？
                // 目前任務系統設計為今日任務，所以只要沒完成就是紅點。
                showBadge = true;
            }
        });

        if (showBadge) {
            badge.classList.add('active');
        } else {
            badge.classList.remove('active');
        }
    });
}

// 監聽儲存變化 (例如在側欄新增任務後，網頁按鈕立刻更新)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.tasks && namespace === 'local') {
        updateBadgeStatus();
    }
});

// 定時檢查 (處理跨越分鐘的提醒)
setInterval(updateBadgeStatus, 60000);

// 安全注入機制
if (document.body) {
    createAssistiveTouchBtn();
} else {
    document.addEventListener('DOMContentLoaded', createAssistiveTouchBtn);
}
