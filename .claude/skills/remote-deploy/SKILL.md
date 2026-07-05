---
name: remote-deploy
description: 当用户要求部署、运行、调试服务、修改 Nginx/Caddy 配置、或执行任何服务器命令时，必须触发此远程服务器部署约束。
disable-model-invocation: false
user-invocable: true
---

# Skill: ui设计风格约束

- **ui设计风格**：`Material Design 3 (Material You)`


## 核心规则
4. **测试可选**：Playwright 等端到端测试可按需在本地执行，通过环境变量指定远程前端地址（如 `FRONTEND_URL=http://172.29.84.122:3000`），但不作为强制要求。
5. **语言要求**：所有回答必须使用中文。
6. **端口冲突处理（硬性）**：部署时若发现目标端口被占用，必须修改本项目的服务端口（如 docker-compose.yml 中的端口映射），严禁关闭或杀死占用端口的原有进程。禁止占用系统敏感端口（如 22、80、443、3306、5432、6379 等），优先使用 10000 以上端口。
7. **Nginx/Caddy 配置修改**：所有对 Nginx 或 Caddy 的配置变更，必须新建独立的配置文件（如 `/etc/nginx/conf.d/myapp.conf` 或 Caddy 的独立站点文件），并通过挂载或 include 方式加载。严禁直接修改原有的 `nginx.conf`、`Caddyfile` 或其他已有站点的配置文件。
8. **禁止私自安装系统软件**：严禁在服务器上安装任何系统级软件（如 apt/yum 安装的包、外部二进制程序等）。npm 包和 Python 依赖（通过 pip/poetry 安装）不受此限制。若项目必需系统软件，需经用户确认后再执行。


请严格遵循此 Skill，确保所有实施步骤均落在指定远程服务器上。