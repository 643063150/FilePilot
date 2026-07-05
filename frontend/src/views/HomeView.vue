<template>
  <div class="home">
    <!-- 标签栏 -->
    <div class="tabs">
      <div
        v-for="tab in tabs" :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <span class="mdi" :class="tab.icon"></span>
        <span class="tab-title">{{ tab.title }}</span>
        <span v-if="tab.closable" class="tab-x" @click.stop="closeTab(tab.id)">×</span>
      </div>
    </div>

    <!-- 首页 -->
    <div v-show="activeTab === 'home'" class="page">
      <!-- 搜索主页 -->
      <div v-if="view === 'home'" class="search-home">
        <div class="hero">
          <span class="mdi mdi-file-tree hero-icon"></span>
          <h1>FilePilot</h1>
          <p class="sub">搜索你的文件</p>
          <div class="search-row">
            <input v-model="keyword" class="search-input" placeholder="输入关键词搜索文件..." @keyup.enter="doSearch" />
            <button class="btn-primary" @click="doSearch" :disabled="!keyword">搜索</button>
          </div>
        </div>

        <div v-if="recentFiles.length > 0" class="recent">
          <h2><span class="mdi mdi-history"></span> 最近打开</h2>
          <div class="file-list">
            <div
              v-for="file in recentFiles" :key="file.root_path + '/' + file.rel_path"
              class="file-item"
              @click="openRecentFile(file)"
              @contextmenu.prevent="onCtx($event, file, 'recent')"
            >
              <span class="mdi mdi-file-outline file-icon"></span>
              <div class="file-info">
                <div class="file-name">{{ file.file_name }}</div>
                <div class="file-path">{{ file.root_path }}</div>
              </div>
              <button class="btn-delete" @click.stop="deleteRecent(file)" title="从记录中移除">×</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="view === 'results'" class="results-page">
        <div class="top-bar">
          <button class="btn-back" @click="view = 'home'">← 返回</button>
          <input v-model="keyword" class="search-input" @keyup.enter="doSearch" placeholder="搜索..." />
          <button class="btn-primary" @click="doSearch">搜索</button>
        </div>
        <h2 class="result-title">搜索结果 ({{ searchResults.length }})</h2>
        <div class="file-list">
          <div
            v-for="file in searchResults" :key="file.id"
            class="file-item"
            @click="openFile(file)"
            @contextmenu.prevent="onCtx($event, file, 'search')"
          >
            <span class="mdi file-icon" :class="getIcon(file.file_name)"></span>
            <div class="file-info">
              <div class="file-name">{{ file.file_name }}</div>
              <div class="file-path">{{ file.root_path }}/{{ file.relative_path }}</div>
              <div class="file-meta">{{ fmtSize(file.file_size) }}</div>
            </div>
          </div>
          <div v-if="searchResults.length === 0" class="empty">
            <span class="mdi mdi-file-search-outline empty-icon"></span>
            <p>未找到匹配的文件</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 标签页内容 -->
    <div v-for="tab in fileTabs" :key="tab.id" v-show="activeTab === tab.id" class="page no-scroll">
      <div class="preview-bar">
        <span class="mdi" :class="getIcon(tab.file?.file_name || '')"></span>
        <span class="preview-title">{{ tab.file?.file_name }}</span>
        <button class="btn-action" @click="openFileWithDefault(tab.file)">打开文件</button>
        <button class="btn-action" @click="copyPath(tab.file)">复制路径</button>
        <button class="btn-action" @click="openLocation(tab.file)">打开位置</button>
      </div>
      <div class="preview-wrapper">
        <!-- 大纲侧边栏 -->
        <div v-if="tab.headings && tab.headings.length > 0" class="outline-sidebar" :class="{ collapsed: !tab.showOutline }">
          <button class="outline-toggle" @click="tab.showOutline = !tab.showOutline" :title="tab.showOutline ? '隐藏大纲' : '显示大纲'">
            <span class="mdi" :class="tab.showOutline ? 'mdi-chevron-right' : 'mdi-format-list-bulleted'"></span>
          </button>
          <div v-show="tab.showOutline" class="outline-content">
            <div class="outline-title">大纲</div>
            <div class="outline-list">
              <a
                v-for="(h, i) in tab.headings" :key="i"
                class="outline-item"
                :style="{ paddingLeft: (h.level - 1) * 12 + 'px' }"
                @click.prevent="scrollToHeading(tab.id, h.id)"
              >
                {{ h.text }}
              </a>
            </div>
          </div>
        </div>

        <div class="preview-box">
          <iframe v-if="tab.isPdf && tab.pdfUrl" :src="tab.pdfUrl" class="pdf-viewer"></iframe>
          <div v-else-if="tab.content && tab.isHtml" class="preview-html" :id="'preview-' + tab.id" v-html="tab.content"></div>
          <pre v-else-if="tab.content" class="preview-text">{{ tab.content }}</pre>
          <div v-else class="loading">
            <div class="spinner"></div>
            <p>{{ tab.progress?.message || tab.loadingText || '加载中...' }}</p>
            <div v-if="tab.progress" class="progress-bar">
              <div class="progress-fill" :style="{ width: tab.progress.percent + '%' }"></div>
            </div>
            <p v-if="tab.progress" class="progress-text">{{ tab.progress.percent }}%</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单（智能定位，避免被遮挡） -->
    <div v-if="ctx.show" class="ctx-overlay" @click="ctx.show = false"></div>
    <div v-if="ctx.show" class="ctx-menu" :style="ctxStyle">
      <div class="ctx-item" @click="ctxOpen">在新标签页打开</div>
      <div class="ctx-item" @click="ctxCopy">复制完整路径</div>
      <div class="ctx-item" @click="ctxLocation">打开所在位置</div>
      <div v-if="ctx.type === 'recent'" class="ctx-item ctx-danger" @click="ctxDelete">从记录中移除</div>
    </div>

    <!-- 回到顶部按钮 -->
    <button v-show="showBackToTop" class="back-to-top" @click="scrollToTop" title="回到顶部">
      <span class="mdi mdi-chevron-up"></span>
    </button>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Heading { level: number; id: string; text: string }
interface Tab {
  id: string; title: string; icon: string; closable: boolean;
  file?: any; content?: string; loadingText?: string;
  isHtml?: boolean; isPdf?: boolean; pdfUrl?: string;
  headings?: Heading[]; showOutline?: boolean;
  progress?: { percent: number; message: string } | null;
  taskId?: string;
}

const activeTab = ref('home')
const view = ref<'home' | 'results'>('home')
const keyword = ref('')
const searchResults = ref<any[]>([])
const recentFiles = ref<any[]>([])
const toast = ref('')
let tabId = 0

const tabs = ref<Tab[]>([{ id: 'home', title: '首页', icon: 'mdi-home', closable: false }])
const fileTabs = computed(() => tabs.value.filter(t => t.id !== 'home'))

const ctx = ref({ show: false, x: 0, y: 0, file: null as any, type: '' })
const showBackToTop = ref(false)

// 右键菜单智能定位
const ctxStyle = computed(() => {
  const menuHeight = ctx.value.type === 'recent' ? 160 : 120
  const viewportH = window.innerHeight
  let top = ctx.value.y
  // 如果菜单底部会超出视口，向上弹出
  if (top + menuHeight > viewportH) {
    top = viewportH - menuHeight - 8
  }
  return { left: ctx.value.x + 'px', top: top + 'px' }
})

const showToast = (msg: string) => { toast.value = msg; setTimeout(() => toast.value = '', 2000) }

// 构建完整路径（兼容不同来源的字段名）
const buildPath = (file: any) => {
  if (!file) return ''
  const root = file.root_path || file.rootPath || ''
  const rel = file.relative_path || file.relPath || file.rel_path || ''
  return root + '/' + rel
}

// 加载历史记录
const loadRecent = async () => {
  const api = (window as any).api
  if (!api) return
  const list = await api.recent.list(50)
  const seen = new Set()
  recentFiles.value = list.filter((f: any) => {
    const key = f.root_path + '/' + f.rel_path
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 监听滚动事件
const handleScroll = () => {
  const page = document.querySelector('.page')
  if (page) {
    showBackToTop.value = page.scrollTop > 200
  }
}

// 监听预览进度
const setupProgressListener = () => {
  const api = (window as any).api
  if (api && api.onPreviewProgress) {
    api.onPreviewProgress((data: any) => {
      // 通过 taskId 找到对应的 tab
      for (const t of tabs.value) {
        if (t.taskId === data.taskId) {
          t.progress = { percent: data.percent || 0, message: data.message || '' }
          break
        }
      }
    })
  }
}

onMounted(() => {
  loadRecent()
  setupProgressListener()
  // 延迟绑定滚动事件
  setTimeout(() => {
    const page = document.querySelector('.page')
    if (page) {
      page.addEventListener('scroll', handleScroll)
    }
  }, 100)
})

// 回到顶部
const scrollToTop = () => {
  const page = document.querySelector('.page')
  if (page) {
    page.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 搜索
const doSearch = async () => {
  if (!keyword.value) return
  const api = (window as any).api
  if (!api) return
  const result = await api.search(keyword.value)
  searchResults.value = result.files
  view.value = 'results'
}

// 打开搜索结果文件（有 files 表的 id）
const openFile = async (file: any) => {
  try {
    const api = (window as any).api
    if (!api) { console.error('[openFile] api 不可用'); return }

    const fileName = file.file_name || file.fileName || '未知'
    const filePath = buildPath(file)
    api.log(`[openFile] 点击: ${fileName}, id: ${file.id}, path: ${filePath}`).catch(() => {})

    // 检查是否已有标签页
    const existing = tabs.value.find(t => {
      if (t.file?.id && file.id && t.file.id === file.id) return true
      return buildPath(t.file) === filePath
    })
    if (existing) { activeTab.value = existing.id; return }

    const id = `f${++tabId}`
    const tab: Tab = {
      id, title: fileName, icon: getIcon(fileName), closable: true,
      file, content: '', loadingText: '正在加载文件内容...',
      progress: { percent: 0, message: '准备中...' },
    }
    tabs.value.push(tab)
    activeTab.value = id

    api.log(`[openFile] 调用 preview id=${file.id}`).catch(() => {})
    const result = await api.preview(file.id)
    api.log(`[openFile] preview 成功`).catch(() => {})
    const currentTab = tabs.value.find(t => t.id === id)
    if (currentTab) {
      currentTab.taskId = result.taskId
      currentTab.content = result.content
      currentTab.isHtml = result.isHtml || false
      currentTab.isPdf = result.isPdf || false
      currentTab.progress = null
      if (result.isPdf && result.content) {
        const port = await api.getServerPort()
        currentTab.pdfUrl = `http://127.0.0.1:${port}/${encodeURIComponent(result.content)}`
      }
      if (result.headings && result.headings.length > 0) {
        currentTab.headings = result.headings
        currentTab.showOutline = true
      }
    }
    // 刷新历史记录
    loadRecent()
  } catch (e: any) {
    console.error('[openFile] 错误:', e)
    ;(window as any).api?.log(`[openFile] 错误: ${e.message}`).catch(() => {})
  }
}

// 打开历史记录文件（需要先通过路径找到 files 表的 id）
const openRecentFile = async (file: any) => {
  try {
    const api = (window as any).api
    if (!api) { console.error('[openRecentFile] api 不可用'); return }

    const filePath = buildPath(file)
    api.log(`[openRecentFile] 点击: ${file.file_name}, path: ${filePath}`).catch(() => {})

    // 检查是否已有标签页
    const existing = tabs.value.find(t => buildPath(t.file) === filePath)
    if (existing) { activeTab.value = existing.id; return }

    // 通过路径搜索 files 表获取真实 id
    let fileData = { ...file }
    try {
      const result = await api.search(file.file_name, 100)
      api.log(`[openRecentFile] 搜索到 ${result.files.length} 条`).catch(() => {})
      const matched = result.files.find((f: any) => buildPath(f) === filePath)
      if (matched) {
        api.log(`[openRecentFile] 匹配 id=${matched.id}`).catch(() => {})
        fileData = matched
      } else {
        api.log(`[openRecentFile] 无匹配，用原始 id=${file.id}`).catch(() => {})
      }
    } catch (e: any) {
      api.log(`[openRecentFile] 搜索失败: ${e.message}`).catch(() => {})
    }

    const id = `f${++tabId}`
    const tab: Tab = {
      id, title: file.file_name, icon: getIcon(file.file_name), closable: true,
      file: fileData, content: '', loadingText: '正在加载文件内容...',
      progress: { percent: 0, message: '准备中...' },
    }
    tabs.value.push(tab)
    activeTab.value = id

    api.log(`[openRecentFile] preview id=${fileData.id}`).catch(() => {})
    const result = await api.preview(fileData.id)
    api.log(`[openRecentFile] preview 成功`).catch(() => {})
    const currentTab = tabs.value.find(t => t.id === id)
    if (currentTab) {
      currentTab.taskId = result.taskId
      currentTab.content = result.content
      currentTab.isHtml = result.isHtml || false
      currentTab.isPdf = result.isPdf || false
      currentTab.progress = null
      if (result.isPdf && result.content) {
        const port = await api.getServerPort()
        currentTab.pdfUrl = `http://127.0.0.1:${port}/${encodeURIComponent(result.content)}`
      }
      if (result.headings && result.headings.length > 0) {
        currentTab.headings = result.headings
        currentTab.showOutline = true
      }
    }
    // 刷新历史记录
    loadRecent()
  } catch (e: any) {
    console.error('[openRecentFile] 错误:', e)
    ;(window as any).api?.log(`[openRecentFile] 错误: ${e.message}`).catch(() => {})
  }
}

// 删除历史记录
const deleteRecent = async (file: any) => {
  const api = (window as any).api
  if (!api) return
  try {
    await api.recent.delete(file.root_path, file.rel_path)
    await loadRecent()
    showToast('已从记录中移除')
  } catch (e) {}
}

const closeTab = (id: string) => {
  const idx = tabs.value.findIndex(t => t.id === id)
  if (idx < 0) return
  tabs.value.splice(idx, 1)
  if (activeTab.value === id && tabs.value.length > 0) {
    activeTab.value = tabs.value[Math.max(0, idx - 1)].id
  }
}

// 右键菜单
const onCtx = (e: MouseEvent, file: any, type: string) => {
  ctx.value = { show: true, x: e.clientX, y: e.clientY, file, type }
}

const ctxOpen = () => {
  ctx.value.show = false
  if (ctx.value.file) {
    if (ctx.value.type === 'recent') openRecentFile(ctx.value.file)
    else openFile(ctx.value.file)
  }
}

const ctxCopy = () => {
  ctx.value.show = false
  if (ctx.value.file) {
    navigator.clipboard.writeText(buildPath(ctx.value.file))
    showToast('路径已复制')
  }
}

const ctxLocation = () => {
  ctx.value.show = false
  if (ctx.value.file) {
    (window as any).api?.openLocation(buildPath(ctx.value.file))
  }
}

const ctxDelete = () => {
  ctx.value.show = false
  if (ctx.value.file) deleteRecent(ctx.value.file)
}

const copyPath = (file: any) => {
  if (!file) return
  navigator.clipboard.writeText(buildPath(file))
  showToast('路径已复制')
}

const openLocation = (file: any) => {
  if (!file) return
  (window as any).api?.openLocation(buildPath(file))
}

const openFileWithDefault = (file: any) => {
  if (!file) return
  (window as any).api?.openFile(buildPath(file))
}

// 滚动到标题位置
const scrollToHeading = (tabId: string, headingId: string) => {
  const container = document.getElementById(`preview-${tabId}`)
  if (!container) return
  const target = container.querySelector(`#${headingId}`)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const getIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    txt: 'mdi-file-document-outline', md: 'mdi-language-markdown', pdf: 'mdi-file-pdf-box',
    doc: 'mdi-file-word-box', docx: 'mdi-file-word-box', xls: 'mdi-file-excel-box',
    xlsx: 'mdi-file-excel-box', ppt: 'mdi-file-powerpoint-box', pptx: 'mdi-file-powerpoint-box',
    jpg: 'mdi-file-image', jpeg: 'mdi-file-image', png: 'mdi-file-image', gif: 'mdi-file-image',
    json: 'mdi-code-json', xml: 'mdi-xml', csv: 'mdi-file-table', zip: 'mdi-folder-zip',
  }
  return map[ext] || 'mdi-file-outline'
}

const fmtSize = (b: number) => {
  if (!b) return ''
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}
</script>

<style scoped>
.home { display: flex; flex-direction: column; height: 100%; }

.tabs {
  display: flex; height: 36px; min-height: 36px;
  background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  padding: 0 8px; align-items: center; gap: 2px; overflow-x: auto;
}

.tab {
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 6px 6px 0 0; cursor: pointer; font-size: 13px;
  color: var(--text-secondary); border: 1px solid transparent; border-bottom: none;
  white-space: nowrap;
}
.tab:hover { background: var(--hover); }
.tab.active { background: var(--bg); color: var(--primary); font-weight: 500; border-color: var(--border); }
.tab-title { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.tab-x { margin-left: 4px; font-size: 16px; opacity: 0.4; cursor: pointer; }
.tab-x:hover { opacity: 1; }

.page { flex: 1; overflow-y: auto; padding: 24px 32px; }
.page.no-scroll { overflow: hidden; padding: 0; }

.search-home { display: flex; flex-direction: column; min-height: min-content; }

.hero {
  display: flex; flex-direction: column; align-items: center;
  padding-top: 60px; margin-bottom: 32px;
}
.hero-icon { font-size: 56px; color: var(--primary); margin-bottom: 12px; }
.hero h1 { font-size: 28px; margin-bottom: 4px; color: var(--text); }
.sub { color: var(--text-secondary); margin-bottom: 24px; }

.search-row { display: flex; gap: 12px; width: 100%; max-width: 500px; }

.search-input {
  flex: 1; height: 42px; padding: 0 14px;
  border: 2px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; background: var(--bg); color: var(--text);
}
.search-input:focus { border-color: var(--primary); }

.btn-primary {
  height: 42px; padding: 0 20px; background: var(--primary); color: #fff;
  border: none; border-radius: 8px; font-size: 14px; cursor: pointer; white-space: nowrap;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.recent { margin-top: 24px; }
.recent h2 { display: flex; align-items: center; gap: 8px; font-size: 15px; margin-bottom: 10px; color: var(--text); }

.file-list { display: flex; flex-direction: column; gap: 2px; }

.file-item {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; color: var(--text);
}
.file-item:hover { background: var(--hover); }

.file-icon { font-size: 20px; color: var(--text-secondary); flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 14px; font-weight: 500; }
.file-path { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-meta { font-size: 12px; color: var(--text-secondary); }

.btn-delete {
  width: 24px; height: 24px; border: none; background: transparent;
  color: var(--text-secondary); font-size: 18px; cursor: pointer;
  border-radius: 4px; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s;
}
.file-item:hover .btn-delete { opacity: 1; }
.btn-delete:hover { background: #ffebee; color: #d32f2f; }

.empty { text-align: center; padding: 48px 0; color: var(--text-secondary); }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

.top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.btn-back {
  padding: 6px 14px; background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text);
}
.btn-back:hover { background: var(--hover); }
.result-title { font-size: 16px; margin-bottom: 12px; color: var(--text); }

.preview-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px; font-size: 15px; font-weight: 500; color: var(--text);
  background: var(--bg); border-bottom: 1px solid var(--border);
}
.preview-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 预览包装器 - 整行布局 */
.preview-wrapper {
  display: flex; flex: 1; overflow: hidden; gap: 0;
  height: 100%;
}

/* 大纲侧边栏 - 固定高度独立滚动 */
.outline-sidebar {
  display: flex; flex-shrink: 0; position: relative;
  border-right: 1px solid var(--border); background: var(--bg);
  height: 100%;
}

.outline-sidebar.collapsed {
  width: 32px;
}

.outline-toggle {
  position: absolute; top: 8px; right: 4px; z-index: 10;
  width: 24px; height: 24px; border: 1px solid var(--border);
  background: var(--bg); border-radius: 4px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: var(--text-secondary);
}
.outline-toggle:hover { background: var(--hover); }

.outline-content {
  width: 200px; padding: 8px; overflow-y: auto; height: 100%;
}

.outline-title {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 4px 8px; margin-bottom: 4px;
}

.outline-list {
  display: flex; flex-direction: column; gap: 1px;
}

.outline-item {
  display: block; padding: 4px 8px; font-size: 12px;
  color: var(--text); text-decoration: none;
  border-radius: 4px; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.outline-item:hover { background: var(--hover); }

.btn-action {
  padding: 5px 12px; background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--text);
}
.btn-action:hover { background: var(--hover); }

.preview-box {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 0; padding: 20px; flex: 1; overflow: hidden; display: flex; flex-direction: column;
  min-width: 0; height: 100%;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  flex: 1;
  border: none;
  border-radius: 0;
}
.preview-text {
  font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.6;
  white-space: pre-wrap; flex: 1; overflow-y: auto; color: var(--text);
}

.preview-html {
  flex: 1;
  overflow-y: auto;
  color: var(--text);
  line-height: 1.6;
}

.preview-html :deep(h1) { font-size: 24px; margin: 16px 0 8px; font-weight: 700; }
.preview-html :deep(h2) { font-size: 20px; margin: 14px 0 6px; font-weight: 600; }
.preview-html :deep(h3) { font-size: 17px; margin: 12px 0 6px; font-weight: 600; }
.preview-html :deep(p) { margin: 8px 0; }
.preview-html :deep(ul), .preview-html :deep(ol) { padding-left: 24px; margin: 8px 0; }
.preview-html :deep(li) { margin: 4px 0; }
.preview-html :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.preview-html :deep(th), .preview-html :deep(td) { border: 1px solid var(--border); padding: 8px 12px; text-align: left; font-size: 13px; }
.preview-html :deep(th) { background: var(--bg-secondary); font-weight: 600; }
.preview-html :deep(strong) { font-weight: 600; }
.preview-html :deep(em) { font-style: italic; }
.preview-html :deep(code) { background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 13px; }
.preview-html :deep(pre) { background: var(--bg-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; }
.preview-html :deep(pre code) { background: none; padding: 0; }
.preview-html :deep(blockquote) { border-left: 3px solid var(--primary); padding-left: 12px; margin: 8px 0; color: var(--text-secondary); }
.preview-html :deep(img) { max-width: 100%; height: auto; }
.preview-html :deep(a) { color: var(--primary); text-decoration: none; }
.preview-html :deep(a:hover) { text-decoration: underline; }

.loading { text-align: center; padding: 48px 0; color: var(--text-secondary); }
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--primary);
  border-radius: 50%; margin: 0 auto 12px; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.progress-bar {
  width: 200px; height: 6px; background: var(--border); border-radius: 3px;
  margin: 12px auto 8px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--primary); border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 14px; font-weight: 500; color: var(--primary);
}

.ctx-overlay { position: fixed; inset: 0; z-index: 999; }
.ctx-menu {
  position: fixed; z-index: 1000; background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 4px 0; min-width: 160px;
}
.ctx-item { padding: 8px 16px; font-size: 13px; cursor: pointer; color: var(--text); }
.ctx-item:hover { background: var(--hover); }
.ctx-danger { color: #d32f2f; }
.ctx-danger:hover { background: #ffebee; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 24px; background: #333; color: #fff; border-radius: 8px; font-size: 14px; z-index: 2000;
}

/* 回到顶部按钮 */
.back-to-top {
  position: fixed; bottom: 24px; right: 24px; z-index: 1000;
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--primary); color: #fff; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 20px;
  transition: opacity 0.2s, transform 0.2s;
}
.back-to-top:hover { transform: scale(1.1); }
</style>
