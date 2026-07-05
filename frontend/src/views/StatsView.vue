<template>
  <div class="stats-page">
    <div class="page-header">
      <span class="mdi mdi-chart-pie header-icon"></span>
      <div>
        <h1>统计</h1>
        <p class="sub">查看文件索引统计信息</p>
      </div>
    </div>

    <div class="overview">
      <div class="stat-card">
        <span class="mdi mdi-file-multiple stat-icon" style="color: #1976d2"></span>
        <div class="stat-value">{{ data.totalFiles }}</div>
        <div class="stat-label">总文件数</div>
      </div>
      <div class="stat-card">
        <span class="mdi mdi-harddisk stat-icon" style="color: #4caf50"></span>
        <div class="stat-value">{{ fmtSize(data.totalSize) }}</div>
        <div class="stat-label">总大小</div>
      </div>
      <div class="stat-card">
        <span class="mdi mdi-folder-multiple stat-icon" style="color: #ff9800"></span>
        <div class="stat-value">{{ data.folderCount }}</div>
        <div class="stat-label">索引文件夹</div>
      </div>
      <div class="stat-card">
        <span class="mdi mdi-file-tree stat-icon" style="color: #2196f3"></span>
        <div class="stat-value">{{ data.fileTypes?.length || 0 }}</div>
        <div class="stat-label">文件类型</div>
      </div>
    </div>

    <div class="charts-row">
      <!-- 饼图 -->
      <div class="chart-card">
        <h2>文件类型分布</h2>
        <div class="pie-container">
          <svg viewBox="0 0 200 200" class="pie-svg">
            <circle
              v-for="(slice, i) in pieSlices" :key="i"
              cx="100" cy="100" r="80"
              fill="transparent"
              :stroke="slice.color"
              stroke-width="40"
              :stroke-dasharray="slice.dash"
              :stroke-dashoffset="slice.offset"
              :transform="'rotate(-90 100 100)'"
            />
          </svg>
          <div class="pie-legend">
            <div v-for="(item, i) in data.fileTypes?.slice(0, 8)" :key="i" class="legend-item">
              <span class="legend-dot" :style="{ background: colors[i % colors.length] }"></span>
              <span class="legend-label">{{ item.ext }}</span>
              <span class="legend-value">{{ item.count }} ({{ item.percent.toFixed(1) }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 表格 -->
      <div class="chart-card">
        <h2>详细统计</h2>
        <table>
          <thead>
            <tr><th>扩展名</th><th>数量</th><th>大小</th><th>占比</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in data.fileTypes" :key="item.ext">
              <td><span class="ext-tag">{{ item.ext }}</span></td>
              <td>{{ item.count }}</td>
              <td>{{ fmtSize(item.totalSize) }}</td>
              <td>
                <div class="bar-cell">
                  <div class="bar-bg"><div class="bar-fill" :style="{ width: item.percent + '%' }"></div></div>
                  <span>{{ Math.round(item.percent) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'

const data = reactive({
  totalFiles: 0, totalSize: 0, folderCount: 0,
  fileTypes: [] as Array<{ ext: string; count: number; totalSize: number; percent: number }>,
})

const colors = ['#4F8CF7', '#7C4DFF', '#00C853', '#FF9100', '#FF5252', '#00B8D4', '#FFD600', '#9E9E9E']

const pieSlices = computed(() => {
  const slices: Array<{ color: string; dash: string; offset: string }> = []
  const circumference = 2 * Math.PI * 80 // ~502.65
  const types = data.fileTypes?.slice(0, 8) || []

  let accumulated = 0
  types.forEach((item, i) => {
    const percent = item.percent / 100
    const dashLength = percent * circumference
    const dashArray = `${dashLength} ${circumference - dashLength}`
    const offset = -accumulated * circumference

    slices.push({
      color: colors[i % colors.length],
      dash: dashArray,
      offset: String(offset),
    })
    accumulated += percent
  })

  // 剩余部分
  if (data.fileTypes && data.fileTypes.length > 8) {
    const remaining = data.fileTypes.slice(8).reduce((sum, t) => sum + t.percent, 0) / 100
    const dashLength = remaining * circumference
    slices.push({
      color: '#E0E0E0',
      dash: `${dashLength} ${circumference - dashLength}`,
      offset: String(-accumulated * circumference),
    })
  }

  return slices
})

onMounted(async () => {
  const api = (window as any).api
  if (api) {
    const stats = await api.stats()
    Object.assign(data, stats)
  }
})

const fmtSize = (b: number) => {
  if (!b) return '0 B'
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}
</script>

<style scoped>
.stats-page { padding: 24px 32px; height: 100%; overflow-y: auto; }

.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
.header-icon { font-size: 28px; color: var(--primary); }
.page-header h1 { font-size: 22px; font-weight: 700; color: var(--text); }
.sub { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }

.stat-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
  padding: 20px; text-align: center;
}
.stat-icon { font-size: 36px; margin-bottom: 8px; }
.stat-value { font-size: 22px; font-weight: 700; color: var(--text); }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.chart-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px;
}
.chart-card h2 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: var(--text); }

.pie-container { display: flex; align-items: center; gap: 24px; }
.pie-svg { width: 160px; height: 160px; flex-shrink: 0; }

.pie-legend { flex: 1; }
.legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.legend-label { font-weight: 500; color: var(--text); min-width: 40px; }
.legend-value { color: var(--text-secondary); font-size: 12px; }

table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
th { font-weight: 600; color: var(--text-secondary); }
td { color: var(--text); }

.ext-tag {
  display: inline-block; padding: 2px 10px; background: rgba(25, 118, 210, 0.1);
  color: var(--primary); border-radius: 12px; font-size: 12px;
}

.bar-cell { display: flex; align-items: center; gap: 8px; }
.bar-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--primary); border-radius: 3px; }
.bar-cell span { font-size: 12px; color: var(--text-secondary); min-width: 32px; }
</style>
