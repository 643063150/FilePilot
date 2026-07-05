const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 前端日志
  log: (msg) => ipcRenderer.invoke('log', msg),

  // 获取本地服务器端口
  getServerPort: () => ipcRenderer.invoke('get:server-port'),

  // 获取 worker 状态
  getWorkerStatus: () => ipcRenderer.invoke('worker:status'),

  // 监听预览进度
  onPreviewProgress: (callback) => {
    ipcRenderer.on('preview-progress', (event, data) => callback(data))
  },
  // 文件夹
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    browse: () => ipcRenderer.invoke('folders:browse'),
    add: (path) => ipcRenderer.invoke('folders:add', path),
    remove: (id) => ipcRenderer.invoke('folders:remove', id),
    reindex: (id) => ipcRenderer.invoke('folders:reindex', id),
  },

  // 搜索
  search: (keyword, limit) => ipcRenderer.invoke('search', keyword, limit),

  // 最近文件
  recent: {
    list: (limit) => ipcRenderer.invoke('recent:list', limit),
    delete: (rootPath, relPath) => ipcRenderer.invoke('recent:delete', rootPath, relPath),
  },

  // 预览
  preview: (id) => ipcRenderer.invoke('preview', id),

  // 统计
  stats: () => ipcRenderer.invoke('stats'),

  // 设置
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // 打开文件位置
  openLocation: (path) => ipcRenderer.invoke('open:location', path),

  // 用默认程序打开文件
  openFile: (path) => ipcRenderer.invoke('open:file', path),

  // 用默认浏览器打开链接
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
})
