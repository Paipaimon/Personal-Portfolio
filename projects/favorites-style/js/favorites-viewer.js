/**
 * 查看本地上传的收藏夹并应用美化样式
 */
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const loadingEl = document.getElementById('viewer-loading');
    const errorEl = document.getElementById('viewer-error');

    if (!id) {
        showError('未指定收藏夹 ID');
        return;
    }

    try {
        const item = await FavoritesStorage.getById(id);
        if (!item) {
            showError('找不到该收藏夹，可能已被删除');
            return;
        }

        document.title = item.name.replace(/\.html?$/i, '') + ' - 美化收藏夹';
        renderBookmark(item.content);
    } catch (err) {
        showError('加载失败：' + err.message);
    }

    function showError(message) {
        loadingEl.style.display = 'none';
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }

    function renderBookmark(rawHtml) {
        const processed = injectBeautifyAssets(rawHtml);

        document.open();
        document.write(processed);
        document.close();
    }

    function injectBeautifyAssets(html) {
        const cssLink = '<link rel="stylesheet" href="css/favorites-style.css">';
        const scriptTag = '<script src="js/favorites-script.js" defer><\/script>';
        const backLink = `
            <div id="viewer-nav" style="position:fixed;top:20px;left:20px;z-index:1001;">
                <a href="index.html" style="display:inline-block;padding:8px 16px;background:#3498db;color:white;text-decoration:none;border-radius:5px;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.2);">← 返回</a>
            </div>`;

        let result = html;

        if (!result.includes('favorites-style.css')) {
            if (/<meta[^>]*charset/i.test(result)) {
                result = result.replace(/(<meta[^>]*charset[^>]*>)/i, `$1\n${cssLink}`);
            } else if (/<title>/i.test(result)) {
                result = result.replace(/(<title>[^<]*<\/title>)/i, `$1\n${cssLink}`);
            } else {
                result = cssLink + '\n' + result;
            }
        }

        if (!result.includes('favorites-script.js')) {
            if (/<\/h1>/i.test(result)) {
                result = result.replace(/(<\/h1>)/i, `$1\n${scriptTag}`);
            } else {
                result = scriptTag + '\n' + result;
            }
        }

        if (!result.includes('viewer-nav')) {
            result = backLink + result;
        }

        return result;
    }
});
