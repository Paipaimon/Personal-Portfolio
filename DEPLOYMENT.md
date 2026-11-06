# 云服务器部署此分支

这是纯静态站点，无需 npm 安装、打包或 Node.js 常驻进程。下面以 Ubuntu / Debian + Nginx 为例；命令在 SSH 登录云服务器后执行。

## 下载代码

```bash
sudo apt update
sudo apt install -y git nginx
sudo git clone --branch codex/canvas-quadrants --single-branch \
  https://github.com/Paipaimon/Personal-Portfolio.git \
  /var/www/personal-portfolio
```

克隆目标应为尚不存在的目录。若已经下载过此分支，使用文末的更新命令即可。

## 配置站点

创建 `/etc/nginx/conf.d/portfolio.conf`，将 `example.com` 替换成自己的域名或服务器公网 IP。使用域名时，先把域名的 A 记录指向服务器公网 IP。

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/personal-portfolio;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
    }
}
```

然后检查并应用配置：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

在云服务器安全组放行 TCP 80；如果服务器还启用了防火墙，也允许 TCP 80。随后访问 `http://你的域名或公网IP/`。若使用宝塔或 1Panel，可直接把站点根目录设为 `/var/www/personal-portfolio`，无需反向代理。

## 后续更新

```bash
sudo git -C /var/www/personal-portfolio pull --ff-only origin codex/canvas-quadrants
```

静态文件更新后直接生效，无需重启应用。浏览器仍显示旧版时强制刷新。若在服务器上直接改过配置文件，先提交或备份修改；Git 遇到冲突会停止更新，不要用强制重置覆盖自己的修改。

参考：[Git 分支克隆说明](https://git-scm.com/docs/git-clone)、[Nginx 静态文件配置](https://nginx.org/en/docs/beginners_guide.html#static)。
