# FilePilot

本地文件索引与预览工具

## 功能特性

- 🔍 快速文件名搜索
- 📄 多格式文件预览（Word、Excel、PDF、Markdown、图片等）
- 🏷️ 浏览器式标签页交互
- 📋 文档大纲导航
- ⚡ Worker 线程池后台转换
- 🎨 深色/浅色主题切换
- 📁 文件夹索引管理
- 📊 文件统计分析

## 技术栈

- **前端**: Vue 3 + Vuetify 4 + TypeScript
- **桌面框架**: Electron 43
- **数据库**: SQLite (sql.js)
- **构建工具**: Vite 8

## 快速开始

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run dev:electron
```

### 构建安装包

```bash
npm run build:electron
```

输出: `frontend/release/FilePilot Setup x.x.x.exe`

## 项目结构

```
FilePilot/
├── frontend/
│   ├── electron/          # Electron 主进程
│   │   ├── main.cjs       # 主进程入口
│   │   ├── preload.cjs    # 预加载脚本
│   │   ├── worker-pool.js # 线程池管理
│   │   └── worker-task.js # Worker 任务
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # 状态管理
│   │   └── plugins/       # 插件配置
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## 支持的文件格式

| 格式 | 预览方式 |
|------|----------|
| DOCX | HTML 渲染（保留格式） |
| DOC | 文本提取 |
| XLSX/XLS | HTML 表格 |
| PDF | 文本提取 |
| Markdown | 渲染 HTML |
| TXT/代码 | 纯文本显示 |
| 图片 | 直接显示 |
| 其他 | 文件信息+打开按钮 |

## 数据存储

- **数据库**: `{安装目录}/data/filepilot.db`
- **缓存**: `%APPDATA%/filepilot`

## 开发文档

详细开发文档请参考 [开发文档.md](开发文档.md)

## 软件说明

用户使用说明请参考 [软件说明.md](软件说明.md)

## 许可证

MIT License

## 开发者

- **GitHub**: [643063150](https://github.com/643063150)
- **稀土掘金**: [zpp](https://juejin.cn/user/2911162523457927)
