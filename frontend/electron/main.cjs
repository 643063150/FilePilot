const { app, BrowserWindow, dialog, ipcMain, shell, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const initSqlJs = require('sql.js')
const mammoth = require('mammoth')
const XLSX = require('xlsx')
const pdfParse = require('pdf-parse')
const { marked } = require('marked')
const WorkerPool = require('./worker-pool')

let db
let dbPath
let localServer = null
let localServerPort = 0
let workerPool = null

// 从 HTML 中提取标题生成大纲
function extractHeadingsFromHtml(html) {
  const headings = []
  const regex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi
  let match
  let idx = 0
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    if (text) {
      headings.push({ level, id: `heading-${idx}`, text })
      idx++
    }
  }

  // 如果没有 h 标签，尝试从 <strong> 或加粗文本提取
  if (headings.length === 0) {
    const strongRegex = /<strong[^>]*>(.*?)<\/strong>/gi
    while ((match = strongRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim()
      if (text && text.length < 100) {
        headings.push({ level: 2, id: `heading-${idx}`, text })
        idx++
      }
    }
  }

  // 给 HTML 中的标题添加 id
  if (headings.length > 0) {
    let headingIdx = 0
    html = html.replace(/<h([1-6])([^>]*)>/gi, (match, level, attrs) => {
      return `<h${level}${attrs} id="heading-${headingIdx++}">`
    })
    // 如果是从 strong 提取的，也给 strong 添加 id
    if (headings[0].id === 'heading-0' && !html.includes('id="heading-')) {
      let strongIdx = 0
      html = html.replace(/<strong([^>]*)>/gi, (match, attrs) => {
        return `<strong${attrs} id="heading-${strongIdx++}">`
      })
    }
  }

  return { headings, html }
}

function getDbPath() {
  // 数据存储在 AppData，更新时不会丢失
  // 卸载时通过 deleteAppDataOnUninstall 配置清理
  const dataDir = app.getPath('userData')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  return path.join(dataDir, 'filepilot.db')
}

async function initDatabase() {
  const SQL = await initSqlJs()
  dbPath = getDbPath()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS root_directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      file_count INTEGER DEFAULT 0,
      total_size INTEGER DEFAULT 0,
      last_indexed TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      root_path TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      modified_time INTEGER,
      file_ext TEXT,
      is_indexed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(root_path, relative_path)
    );
    CREATE TABLE IF NOT EXISTS recent_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      root_path TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      accessed_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  saveDb()
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }
}

// 启动本地 HTTP 服务器用于加载 PDF 等文件
function startLocalServer() {
  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      // 解码 URL 中的文件路径
      const filePath = decodeURIComponent(req.url.substring(1)) // 去掉前导 /

      if (!fs.existsSync(filePath)) {
        res.writeHead(404)
        res.end('File not found')
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      let contentType = 'application/octet-stream'
      if (ext === '.pdf') contentType = 'application/pdf'
      else if (ext === '.png') contentType = 'image/png'
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'

      try {
        const stat = fs.statSync(filePath)
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
        })
        fs.createReadStream(filePath).pipe(res)
      } catch (e) {
        res.writeHead(500)
        res.end('Error reading file')
      }
    })

    localServer.listen(0, '127.0.0.1', () => {
      localServerPort = localServer.address().port
      console.log('[localServer] 启动在端口:', localServerPort)
      resolve()
    })
  })
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params)
  return results.length > 0 ? results[0] : null
}

function runSql(sql, params = []) {
  db.run(sql, params)
  saveDb()
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 监听页面加载事件
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[createWindow] 页面加载失败:', errorCode, errorDescription)
  })

  win.webContents.on('did-finish-load', () => {
    console.log('[createWindow] 页面加载完成')
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    // 生产模式：加载打包后的 dist/index.html
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    console.log('[createWindow] 加载:', indexPath)
    console.log('[createWindow] __dirname:', __dirname)
    console.log('[createWindow] 文件存在:', require('fs').existsSync(indexPath))
    win.loadFile(indexPath).catch(err => {
      console.error('[createWindow] 加载失败:', err)
    })
  }

  return win
}

// Office 文件转换
async function convertDocx(fullPath) {
  const result = await mammoth.convertToHtml({ path: fullPath })
  let html = result.value

  // 简单 HTML 转 Markdown 风格
  let md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<table[^>]*>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<tr[^>]*>/gi, '| ')
    .replace(/<\/tr>/gi, ' |\n')
    .replace(/<td[^>]*>(.*?)<\/td>/gi, '$1 | ')
    .replace(/<th[^>]*>(.*?)<\/th>/gi, '$1 | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return md || '（文档内容为空）'
}

function convertXlsx(fullPath) {
  const workbook = XLSX.readFile(fullPath)
  let output = ''

  for (const sheetName of workbook.SheetNames) {
    output += `## ${sheetName}\n\n`
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_csv(sheet)
    if (data.trim()) {
      // CSV 转 Markdown 表格
      const lines = data.split('\n').filter(l => l.trim())
      if (lines.length > 0) {
        const headers = lines[0].split(',')
        output += '| ' + headers.join(' | ') + ' |\n'
        output += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',')
          output += '| ' + cols.join(' | ') + ' |\n'
        }
      }
    }
    output += '\n'
  }

  return output || '（表格内容为空）'
}

function convertPptx(fullPath) {
  // PPTX 本质上是 zip，提取文本
  try {
    const JSZip = require('jszip')
    // 如果没有 jszip，返回提示
    return 'PPTX 预览需要安装 jszip 库。\n\n请运行: npm install jszip'
  } catch (e) {
    return 'PPTX 预览暂不支持。\n\n请使用 PowerPoint 打开此文件。'
  }
}

function setupIpc() {
  // 前端日志
  ipcMain.handle('log', (event, msg) => {
    console.log('[frontend]', msg)
    return true
  })

  ipcMain.handle('folders:list', () => {
    return queryAll('SELECT * FROM root_directories ORDER BY created_at DESC')
  })

  ipcMain.handle('folders:browse', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择文件夹',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('folders:add', (event, folderPath) => {
    const existing = queryOne('SELECT id FROM root_directories WHERE path = ?', [folderPath])
    if (existing) throw new Error('文件夹已存在')

    runSql('INSERT INTO root_directories (path) VALUES (?)', [folderPath])
    const folder = queryOne('SELECT * FROM root_directories WHERE path = ?', [folderPath])

    indexFolder(folder.id, folderPath)
    return folder
  })

  ipcMain.handle('folders:remove', (event, id) => {
    const folder = queryOne('SELECT path FROM root_directories WHERE id = ?', [id])
    if (!folder) throw new Error('文件夹不存在')

    runSql('DELETE FROM files WHERE root_path = ?', [folder.path])
    runSql('DELETE FROM root_directories WHERE id = ?', [id])
    return true
  })

  ipcMain.handle('folders:reindex', (event, id) => {
    const folder = queryOne('SELECT path FROM root_directories WHERE id = ?', [id])
    if (!folder) throw new Error('文件夹不存在')
    indexFolder(id, folder.path)
    return true
  })

  ipcMain.handle('search', (event, keyword, limit = 100) => {
    const files = queryAll('SELECT * FROM files WHERE file_name LIKE ? ORDER BY file_name LIMIT ?', [`%${keyword}%`, limit])
    if (files.length > 0) {
      console.log('[search] 第一个结果:', JSON.stringify(files[0]))
      const testPath = path.join(files[0].root_path, files[0].relative_path)
      console.log('[search] 拼接路径:', testPath, '存在:', fs.existsSync(testPath))
    }
    return { files, total: files.length }
  })

  ipcMain.handle('recent:list', (event, limit = 50) => {
    return queryAll(`
      SELECT * FROM recent_files
      WHERE id IN (SELECT MAX(id) FROM recent_files GROUP BY root_path, rel_path)
      ORDER BY accessed_at DESC LIMIT ?
    `, [limit])
  })

  ipcMain.handle('recent:delete', (event, rootPath, relPath) => {
    runSql('DELETE FROM recent_files WHERE root_path = ? AND rel_path = ?', [rootPath, relPath])
    return true
  })

  // 预览进度回调
  const previewProgressCallbacks = new Map()

  ipcMain.on('preview-progress-register', (event, taskId) => {
    previewProgressCallbacks.set(taskId, (progress) => {
      event.sender.send('preview-progress', { taskId, ...progress })
    })
  })

  ipcMain.handle('preview', async (event, id) => {
    const file = queryOne('SELECT * FROM files WHERE id = ?', [id])
    if (!file) throw new Error('文件不存在')

    // 去重插入最近文件
    runSql('DELETE FROM recent_files WHERE root_path = ? AND rel_path = ?', [file.root_path, file.relative_path])
    runSql('INSERT INTO recent_files (root_path, rel_path, file_name) VALUES (?, ?, ?)', [file.root_path, file.relative_path, file.file_name])

    const fullPath = path.join(file.root_path, file.relative_path)
    const ext = (file.file_ext || '').toLowerCase()
    const taskId = `preview-${id}-${Date.now()}`

    // 进度回调
    const onProgress = (progress) => {
      event.sender.send('preview-progress', { taskId, ...progress })
    }

    try {
      // PDF -> 返回路径，前端通过本地服务加载
      if (ext === '.pdf') {
        return { file, content: fullPath, isPdf: true }
      }

      // DOCX -> 使用 worker 线程
      if (ext === '.docx' || ext === '.doc') {
        const result = await workerPool.execute({ type: 'convertDocx', filePath: fullPath }, onProgress)
        return { file, ...result, taskId }
      }

      // XLSX -> 使用 worker 线程
      if (ext === '.xlsx' || ext === '.xls') {
        const result = await workerPool.execute({ type: 'convertXlsx', filePath: fullPath }, onProgress)
        return { file, ...result, taskId }
      }

      // Markdown -> 使用 worker 线程
      if (ext === '.md') {
        const result = await workerPool.execute({ type: 'convertMd', filePath: fullPath }, onProgress)
        return { file, ...result, taskId }
      }

      // 已知图片格式 -> 使用 worker 线程
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'].includes(ext)) {
        const result = await workerPool.execute({ type: 'readImage', filePath: fullPath, ext }, onProgress)
        return { file, ...result, taskId }
      }

      // 其他图片格式（PSD, XCF, AI 等）- 不预览
      if (['.psd', '.xcf', '.ai', '.eps', '.raw', '.cr2', '.nef', '.arw', '.dng', '.heic', '.heif'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">🖼️</p><p><b>图片文件</b></p><p>格式: ${ext.toUpperCase()}</p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"查看</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 音视频
      if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4a', '.wma'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">🎬</p><p><b>多媒体文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"播放</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 压缩包
      if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.cab'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">📦</p><p><b>压缩文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"解压</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 可执行文件和系统文件
      if (['.exe', '.msi', '.bat', '.cmd', '.ps1', '.sh', '.dll', '.sys', '.drv', '.lnk', '.url'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">⚙️</p><p><b>可执行文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 数据库文件
      if (['.db', '.sqlite', '.sqlite3', '.mdb', '.accdb'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">🗄️</p><p><b>数据库文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"查看</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 字体文件
      if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">🔤</p><p><b>字体文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 3D/CAD 文件
      if (['.dwg', '.dxf', '.step', '.stp', '.iges', '.igs', '.stl', '.obj', '.fbx', '.blend', '.max', '.c4d'].includes(ext)) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">📐</p><p><b>3D/CAD 文件</b></p><p>格式: ${ext.toUpperCase()}</p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"查看</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 其他文件：先检测是否为二进制，再决定是否读取
      const binaryCheck = await workerPool.execute({ type: 'checkBinary', filePath: fullPath }, () => {})
      if (binaryCheck.isBinary) {
        const html = `<div style="text-align:center;padding:40px"><p style="font-size:48px">📄</p><p><b>二进制文件</b></p><p>路径: ${fullPath}</p><p>大小: ${formatFileSize(file.file_size)}</p><p>请点击"打开文件"查看</p></div>`
        return { file, content: html, isHtml: true }
      }

      // 文本文件 -> 使用 worker 线程读取
      const result = await workerPool.execute({ type: 'readText', filePath: fullPath }, onProgress)
      return { file, ...result, taskId }

    } catch (e) {
      return { file, content: `<p>无法读取文件: ${e.message}</p><p>路径: ${fullPath}</p>`, isHtml: true }
    }
  })

  // 获取 worker 状态
  ipcMain.handle('worker:status', () => {
    return workerPool ? workerPool.getStatus() : null
  })

  ipcMain.handle('stats', () => {
    const fileTypes = queryAll('SELECT file_ext as ext, count(*) as count, sum(file_size) as totalSize FROM files GROUP BY file_ext ORDER BY count DESC')

    // 先计算总数
    let totalFiles = 0
    let totalSize = 0
    fileTypes.forEach(t => {
      totalFiles += t.count
      totalSize += t.totalSize || 0
      if (!t.ext) t.ext = '未知'
    })

    // 再计算百分比
    fileTypes.forEach(t => {
      t.percent = totalFiles > 0 ? (t.count / totalFiles * 100) : 0
    })

    const folderCountRow = queryOne('SELECT count(*) as c FROM root_directories')
    const folderCount = folderCountRow ? folderCountRow.c : 0

    return { totalFiles, totalSize, folderCount, fileTypes }
  })

  ipcMain.handle('settings:get', () => {
    const get = (key, def) => {
      const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
      return row ? row.value : def
    }
    const result = {
      theme: get('theme', '浅色'),
      threshold: parseInt(get('threshold', '100')),
      indexHidden: get('hidden', 'false') === 'true',
      autostart: get('autostart', 'false') === 'true',
    }
    console.log('[settings:get] 返回:', JSON.stringify(result))
    return result
  })

  ipcMain.handle('settings:update', (event, settings) => {
    console.log('[settings:update] 收到设置:', JSON.stringify(settings))
    const set = (key, value) => {
      console.log('[settings:update] 保存:', key, '=', value)
      runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)])
    }
    if (settings.theme !== undefined) set('theme', settings.theme)
    if (settings.threshold !== undefined) set('threshold', settings.threshold)
    if (settings.indexHidden !== undefined) set('hidden', settings.indexHidden)
    if (settings.autostart !== undefined) set('autostart', settings.autostart)
    console.log('[settings:update] 保存完成, dbPath:', dbPath)
    return true
  })

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('open:location', (event, filePath) => {
    // 确保路径存在
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    } else {
      // 如果是文件路径，尝试打开父目录
      const dir = path.dirname(filePath)
      if (fs.existsSync(dir)) {
        shell.openPath(dir)
      }
    }
  })

  // 用默认程序打开文件
  ipcMain.handle('open:file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
      shell.openPath(filePath)
    } else {
      throw new Error('文件不存在: ' + filePath)
    }
  })

  // 用默认浏览器打开链接
  ipcMain.handle('open:external', (event, url) => {
    shell.openExternal(url)
  })

  // 获取本地服务器端口（用于加载 PDF 等文件）
  ipcMain.handle('get:server-port', () => {
    return localServerPort
  })
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function indexFolder(folderId, folderPath) {
  const walk = (dir) => {
    const results = []
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...walk(fullPath))
        } else {
          try {
            const stat = fs.statSync(fullPath)
            results.push({
              root_path: folderPath,
              relative_path: path.relative(folderPath, fullPath),
              file_name: entry.name,
              file_size: stat.size,
              modified_time: Math.floor(stat.mtimeMs / 1000),
              file_ext: path.extname(entry.name).toLowerCase(),
            })
          } catch (e) {}
        }
      }
    } catch (e) {}
    return results
  }

  try {
    const files = walk(folderPath)

    db.run('BEGIN TRANSACTION')
    for (const file of files) {
      db.run(
        'INSERT OR REPLACE INTO files (root_path, relative_path, file_name, file_size, modified_time, file_ext) VALUES (?, ?, ?, ?, ?, ?)',
        [file.root_path, file.relative_path, file.file_name, file.file_size, file.modified_time, file.file_ext]
      )
    }

    const totalSize = files.reduce((sum, f) => sum + f.file_size, 0)
    db.run(
      'UPDATE root_directories SET file_count = ?, total_size = ?, last_indexed = datetime(\'now\', \'localtime\') WHERE id = ?',
      [files.length, totalSize, folderId]
    )
    db.run('COMMIT')
    saveDb()
  } catch (e) {
    try { db.run('ROLLBACK') } catch (e2) {}
    console.error('索引失败:', e)
  }
}

app.whenReady().then(async () => {
  await initDatabase()
  await startLocalServer()
  workerPool = new WorkerPool()
  setupIpc()
  createWindow()
})

app.on('window-all-closed', () => {
  if (db) {
    saveDb()
    db.close()
  }
  app.quit()
})
