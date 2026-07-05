const { parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')

// 处理任务
parentPort.on('message', async (msg) => {
  const { taskId, type, filePath, ext } = msg

  try {
    let result

    switch (type) {
      case 'readText':
        result = await readTextFile(filePath, taskId)
        break
      case 'readImage':
        result = await readImageFile(filePath, ext, taskId)
        break
      case 'convertDocx':
        result = await convertDocx(filePath, taskId)
        break
      case 'convertXlsx':
        result = await convertXlsx(filePath, taskId)
        break
      case 'convertPdf':
        result = await convertPdf(filePath, taskId)
        break
      case 'convertMd':
        result = await convertMd(filePath, taskId)
        break
      case 'checkBinary':
        result = await checkBinary(filePath)
        break
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    parentPort.postMessage({ taskId, type: 'result', result })
  } catch (error) {
    parentPort.postMessage({ taskId, type: 'error', error: error.message })
  }
})

// 发送进度
function sendProgress(taskId, progress) {
  parentPort.postMessage({ taskId, type: 'progress', progress })
}

// 读取文本文件
async function readTextFile(filePath, taskId) {
  const stat = fs.statSync(filePath)
  const fileSize = stat.size

  sendProgress(taskId, { percent: 0, message: '开始读取...' })

  // 大文件分块读取
  if (fileSize > 10 * 1024 * 1024) {
    const chunks = []
    const chunkSize = 1024 * 1024 // 1MB
    let offset = 0

    const fd = fs.openSync(filePath, 'r')
    try {
      while (offset < fileSize) {
        const buf = Buffer.alloc(Math.min(chunkSize, fileSize - offset))
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, offset)
        chunks.push(buf.slice(0, bytesRead).toString('utf-8'))
        offset += bytesRead

        const percent = Math.round((offset / fileSize) * 100)
        sendProgress(taskId, { percent, message: `读取中 ${percent}%` })
      }
    } finally {
      fs.closeSync(fd)
    }

    return { content: chunks.join(''), isHtml: false }
  }

  // 小文件直接读取
  const content = fs.readFileSync(filePath, 'utf-8')
  sendProgress(taskId, { percent: 100, message: '完成' })
  return { content, isHtml: false }
}

// 读取图片文件
async function readImageFile(filePath, ext, taskId) {
  sendProgress(taskId, { percent: 0, message: '加载图片...' })

  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '')}`
  const html = `<div style="text-align:center;padding:20px"><img src="data:${mime};base64,${base64}" style="max-width:100%;max-height:calc(100vh - 260px);object-fit:contain" /></div>`

  sendProgress(taskId, { percent: 100, message: '完成' })
  return { content: html, isHtml: true }
}

// 转换 DOCX/DOC
async function convertDocx(filePath, taskId) {
  const ext = require('path').extname(filePath).toLowerCase()

  // DOC 格式使用 textract 提取文本
  if (ext === '.doc') {
    sendProgress(taskId, { percent: 0, message: '解析 DOC 文件...' })

    try {
      const textract = require('textract')
      const text = await new Promise((resolve, reject) => {
        textract.fromFileWithPath(filePath, (err, text) => {
          if (err) reject(err)
          else resolve(text)
        })
      })

      sendProgress(taskId, { percent: 80, message: '生成预览...' })

      // 将文本转换为 HTML
      const html = text.split('\n')
        .filter(l => l.trim())
        .map(l => `<p>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('')

      sendProgress(taskId, { percent: 100, message: '完成' })
      return { content: html || '<p>（文档内容为空）</p>', isHtml: true, headings: [] }
    } catch (e) {
      const html = `<div style="text-align:center;padding:40px">
        <p style="font-size:48px">📄</p>
        <p><b>DOC 文件解析失败</b></p>
        <p>错误: ${e.message}</p>
        <p>请使用 Word 打开此文件，或转换为 .docx 格式</p>
      </div>`
      return { content: html, isHtml: true, headings: [] }
    }
  }

  sendProgress(taskId, { percent: 0, message: '解析 DOCX...' })

  const mammoth = require('mammoth')
  const result = await mammoth.convertToHtml({ path: filePath })
  const rawHtml = result.value || '<p>（文档内容为空）</p>'

  sendProgress(taskId, { percent: 60, message: '提取大纲...' })

  // 提取标题生成大纲
  const headings = []
  const regex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi
  let match
  let idx = 0
  while ((match = regex.exec(rawHtml)) !== null) {
    const level = parseInt(match[1])
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    if (text) {
      headings.push({ level, id: `heading-${idx}`, text })
      idx++
    }
  }

  // 如果没有 h 标签，尝试从 <strong> 提取
  if (headings.length === 0) {
    const strongRegex = /<strong[^>]*>(.*?)<\/strong>/gi
    while ((match = strongRegex.exec(rawHtml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim()
      if (text && text.length < 100) {
        headings.push({ level: 2, id: `heading-${idx}`, text })
        idx++
      }
    }
  }

  // 给 HTML 中的标题添加 id
  let html = rawHtml
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

  sendProgress(taskId, { percent: 100, message: '完成' })
  return { content: html, isHtml: true, headings }
}

// 转换 XLSX
async function convertXlsx(filePath, taskId) {
  sendProgress(taskId, { percent: 0, message: '解析 XLSX...' })

  const XLSX = require('xlsx')
  const workbook = XLSX.readFile(filePath)
  let html = ''
  const headings = []

  workbook.SheetNames.forEach((sheetName, idx) => {
    html += `<h3 id="sheet-${idx}">${sheetName}</h3>`
    const sheet = workbook.Sheets[sheetName]
    html += XLSX.utils.sheet_to_html(sheet)
    headings.push({ level: 2, id: `sheet-${idx}`, text: sheetName })

    sendProgress(taskId, { percent: Math.round(((idx + 1) / workbook.SheetNames.length) * 100), message: `处理工作表 ${idx + 1}/${workbook.SheetNames.length}` })
  })

  return { content: html || '（表格内容为空）', isHtml: true, headings }
}

// 转换 PDF
async function convertPdf(filePath, taskId) {
  sendProgress(taskId, { percent: 0, message: '解析 PDF...' })

  const pdfParse = require('pdf-parse')
  const buffer = fs.readFileSync(filePath)

  sendProgress(taskId, { percent: 50, message: '提取文本...' })

  const pdfData = await pdfParse(buffer)
  const text = pdfData.text || '（PDF 内容为空或无法提取文本）'

  sendProgress(taskId, { percent: 90, message: '生成预览...' })

  // 将文本按段落转换为 HTML
  const html = text.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('')

  sendProgress(taskId, { percent: 100, message: '完成' })
  return { content: html, isHtml: true }
}

// 转换 Markdown
async function convertMd(filePath, taskId) {
  sendProgress(taskId, { percent: 0, message: '读取文件...' })

  const { marked } = require('marked')
  const raw = fs.readFileSync(filePath, 'utf-8')

  sendProgress(taskId, { percent: 50, message: '渲染 Markdown...' })

  const html = marked(raw)

  sendProgress(taskId, { percent: 90, message: '提取大纲...' })

  // 提取标题生成大纲
  const headings = []
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/gi
  let match
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const id = match[2]
    const text = match[3].replace(/<[^>]+>/g, '').trim()
    headings.push({ level, id, text })
  }

  // 如果 marked 没有生成 id，用备用方式提取
  if (headings.length === 0) {
    const lines = raw.split('\n')
    let idx = 0
    for (const line of lines) {
      const m = line.match(/^(#{1,6})\s+(.+)/)
      if (m) {
        headings.push({
          level: m[1].length,
          id: `heading-${idx}`,
          text: m[2].replace(/[*_`]/g, '').trim()
        })
        idx++
      }
    }

    // 给 HTML 中的标题添加 id
    let headingIdx = 0
    const htmlWithIds = html.replace(/<h([1-6])([^>]*)>/gi, (match, level, attrs) => {
      return `<h${level}${attrs} id="heading-${headingIdx++}">`
    })

    sendProgress(taskId, { percent: 100, message: '完成' })
    return { content: htmlWithIds, isHtml: true, headings }
  }

  sendProgress(taskId, { percent: 100, message: '完成' })
  return { content: html, isHtml: true, headings }
}

// 检查是否为二进制文件
async function checkBinary(filePath) {
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(8192)
  const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0)
  fs.closeSync(fd)

  for (let i = 0; i < bytesRead; i++) {
    if (buf[i] === 0) {
      return { isBinary: true }
    }
  }

  return { isBinary: false }
}
