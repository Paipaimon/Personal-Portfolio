/**
 * 首页：上传收藏夹文件并管理本地列表
 */
document.addEventListener('DOMContentLoaded', async () => {
    const uploadInput = document.getElementById('bookmark-upload');
    const uploadZone = document.getElementById('upload-zone');
    const uploadedList = document.getElementById('uploaded-list');
    const uploadStatus = document.getElementById('upload-status');

    if (!uploadInput || !uploadedList) return;

    uploadZone.addEventListener('click', () => uploadInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    uploadInput.addEventListener('change', () => {
        handleFiles(uploadInput.files);
        uploadInput.value = '';
    });

    uploadedList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
            e.preventDefault();
            const id = deleteBtn.dataset.deleteId;
            if (confirm('确定删除此收藏夹？数据仅保存在本机浏览器中。')) {
                await FavoritesStorage.remove(id);
                showStatus('已删除', 'success');
                renderUploadedList();
            }
            return;
        }
    });

    await renderUploadedList();

    async function handleFiles(fileList) {
        const files = Array.from(fileList);
        if (!files.length) return;

        let successCount = 0;

        for (const file of files) {
            if (!isValidBookmarkFile(file)) {
                showStatus(`「${file.name}」不是有效的收藏夹 HTML 文件`, 'error');
                continue;
            }

            try {
                const content = await readFileAsText(file);
                if (!isValidBookmarkContent(content)) {
                    showStatus(`「${file.name}」内容不符合浏览器收藏夹格式`, 'error');
                    continue;
                }

                await FavoritesStorage.save(file.name, content);
                successCount++;
            } catch (err) {
                showStatus(`上传「${file.name}」失败：${err.message}`, 'error');
            }
        }

        if (successCount > 0) {
            showStatus(`成功保存 ${successCount} 个收藏夹到本地`, 'success');
            await renderUploadedList();
        }
    }

    function isValidBookmarkFile(file) {
        return file.type === 'text/html' || /\.html?$/i.test(file.name);
    }

    function isValidBookmarkContent(content) {
        const normalized = content.toLowerCase();
        return (
            normalized.includes('netscape-bookmark-file') ||
            (normalized.includes('<dl') && (normalized.includes('<dt') || normalized.includes('<h3')))
        );
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatDate(timestamp) {
        return new Date(timestamp).toLocaleString('zh-CN');
    }

    async function renderUploadedList() {
        const items = await FavoritesStorage.getAll();
        const section = document.getElementById('uploaded-section');

        if (!items.length) {
            section.style.display = 'none';
            uploadedList.innerHTML = '';
            return;
        }

        section.style.display = 'block';
        uploadedList.innerHTML = items.map(item => `
            <div class="uploaded-item">
                <a href="viewer.html?id=${encodeURIComponent(item.id)}" class="file-link uploaded-link">
                    <span class="uploaded-name">${escapeHtml(item.name)}</span>
                    <span class="uploaded-meta">${formatDate(item.uploadedAt)} · ${formatSize(item.size)}</span>
                </a>
                <button type="button" class="delete-btn" data-delete-id="${item.id}" title="删除">×</button>
            </div>
        `).join('');
    }

    function showStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = `upload-status ${type}`;
        uploadStatus.style.display = 'block';
        clearTimeout(showStatus.timer);
        showStatus.timer = setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 4000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
