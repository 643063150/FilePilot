<template>
  <div class="folders-page">
    <div class="page-header">
      <span class="mdi mdi-folder-multiple header-icon"></span>
      <div>
        <h1>文件夹管理</h1>
        <p class="sub">管理你的索引目录</p>
      </div>
    </div>

    <div class="grid">
      <div class="card add-card" @click="browseFolder">
        <span class="mdi mdi-plus-circle-outline add-icon"></span>
        <span>添加文件夹</span>
      </div>

      <div v-for="folder in folders" :key="folder.id" class="card"
        @contextmenu.prevent="onCtx($event, folder)">
        <div class="card-top">
          <span class="mdi mdi-folder card-folder-icon"></span>
          <div class="card-info">
            <div class="card-name">{{ getName(folder.path) }}</div>
            <div class="card-path">{{ folder.path }}</div>
          </div>
        </div>
        <div class="card-stats">
          {{ folder.file_count }} 个文件 · {{ fmtSize(folder.total_size) }}
        </div>
        <div class="card-time">
          最后索引: {{ fmtDate(folder.last_indexed) }}
        </div>
        <div class="card-actions">
          <button class="btn" @click="reindex(folder)">重新索引</button>
          <button class="btn danger" @click="remove(folder)">移除</button>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="ctx.show" class="ctx-overlay" @click="ctx.show = false"></div>
    <div v-if="ctx.show" class="ctx-menu" :style="ctxStyle">
      <div class="ctx-item" @click="ctxReindex">重新索引</div>
      <div class="ctx-item" @click="ctxCopy">复制路径</div>
      <div class="ctx-item danger" @click="ctxRemove">移除文件夹</div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const folders = ref<any[]>([])
const toast = ref('')
const ctx = ref({ show: false, x: 0, y: 0, folder: null as any })

const ctxStyle = computed(() => {
  const menuHeight = 120
  const viewportH = window.innerHeight
  let top = ctx.value.y
  if (top + menuHeight > viewportH) {
    top = viewportH - menuHeight - 8
  }
  return { left: ctx.value.x + 'px', top: top + 'px' }
})

const showToast = (msg: string) => { toast.value = msg; setTimeout(() => toast.value = '', 2000) }

onMounted(async () => {
  const api = (window as any).api
  if (api) {
    folders.value = await api.folders.list()
    api.log(`[FoldersView] 加载文件夹: ${folders.value.length} 个`).catch(() => {})
    if (folders.value.length > 0) {
      api.log(`[FoldersView] 第一个文件夹 last_indexed: ${folders.value[0].last_indexed}`).catch(() => {})
    }
  }
})

const getName = (p: string) => p.split(/[/\\]/).pop() || p

const fmtSize = (b: number) => {
  if (!b) return '0 B'
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}

const fmtDate = (s: string) => {
  if (!s) return '未索引'
  // 兼容 "2026-07-05 00:18:52" 和 ISO 格式
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const browseFolder = async () => {
  const api = (window as any).api
  if (!api) return
  const path = await api.folders.browse()
  if (!path) return
  try {
    await api.folders.add(path)
    folders.value = await api.folders.list()
    showToast('文件夹添加成功，开始索引...')
  } catch (e: any) {
    showToast('添加失败: ' + e.message)
  }
}

const reindex = async (folder: any) => {
  const api = (window as any).api
  if (!api) return
  try {
    await api.folders.reindex(folder.id)
    showToast('开始重新索引...')
    setTimeout(async () => { folders.value = await api.folders.list() }, 3000)
  } catch (e: any) { showToast('索引失败') }
}

const remove = async (folder: any) => {
  const api = (window as any).api
  if (!api) return
  if (!confirm('确定要移除该文件夹吗？所有索引数据将被删除。')) return
  try {
    await api.folders.remove(folder.id)
    folders.value = await api.folders.list()
    showToast('文件夹已移除')
  } catch (e: any) { showToast('移除失败') }
}

const onCtx = (e: MouseEvent, folder: any) => {
  ctx.value = { show: true, x: e.clientX, y: e.clientY, folder }
}
const ctxReindex = () => { ctx.value.show = false; if (ctx.value.folder) reindex(ctx.value.folder) }
const ctxCopy = () => {
  ctx.value.show = false
  if (ctx.value.folder) { navigator.clipboard.writeText(ctx.value.folder.path); showToast('路径已复制') }
}
const ctxRemove = () => { ctx.value.show = false; if (ctx.value.folder) remove(ctx.value.folder) }
</script>

<style scoped>
.folders-page { padding: 24px 32px; height: 100%; overflow-y: auto; }

.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
.header-icon { font-size: 28px; color: var(--primary); }
.page-header h1 { font-size: 22px; font-weight: 700; color: var(--text); }
.sub { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }

.card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px; display: flex; flex-direction: column; gap: 10px;
}
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

.add-card {
  border: 2px dashed var(--primary); background: rgba(25, 118, 210, 0.04);
  cursor: pointer; align-items: center; justify-content: center; min-height: 140px;
  font-size: 15px; font-weight: 500; color: var(--primary);
}
.add-card:hover { background: rgba(25, 118, 210, 0.08); }
.add-icon { font-size: 40px; margin-bottom: 4px; }

.card-top { display: flex; align-items: center; gap: 12px; }
.card-folder-icon { font-size: 32px; color: var(--primary); }
.card-info { flex: 1; min-width: 0; }
.card-name { font-size: 14px; font-weight: 600; color: var(--text); }
.card-path { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-stats { font-size: 12px; color: var(--text-secondary); }
.card-time { font-size: 12px; color: var(--text-secondary); }

.card-actions { display: flex; gap: 8px; margin-top: auto; }

.btn {
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); cursor: pointer; font-size: 12px; color: var(--text);
}
.btn:hover { background: var(--hover); }
.btn.danger { color: #d32f2f; border-color: #ffcdd2; }
.btn.danger:hover { background: #ffebee; }

.ctx-overlay { position: fixed; inset: 0; z-index: 999; }
.ctx-menu {
  position: fixed; z-index: 1000; background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 4px 0; min-width: 140px;
}
.ctx-item { padding: 8px 16px; font-size: 13px; cursor: pointer; color: var(--text); }
.ctx-item:hover { background: var(--hover); }
.ctx-item.danger { color: #d32f2f; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 24px; background: #333; color: #fff; border-radius: 8px; font-size: 14px;
}
</style>
