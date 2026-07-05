<template>
  <div class="settings-page">
    <div class="page-header">
      <span class="mdi mdi-cog header-icon"></span>
      <div>
        <h1>设置</h1>
        <p class="sub">配置应用程序选项</p>
      </div>
    </div>

    <div class="settings-container">
      <div class="section">
        <h2><span class="mdi mdi-palette"></span> 外观</h2>
        <div class="field">
          <label>主题模式</label>
          <div class="radio-group">
            <label class="radio-item" :class="{ selected: settings.theme === '浅色' }">
              <input type="radio" v-model="settings.theme" value="浅色" @change="save" />
              <span class="mdi mdi-weather-sunny"></span> 浅色
            </label>
            <label class="radio-item" :class="{ selected: settings.theme === '深色' }">
              <input type="radio" v-model="settings.theme" value="深色" @change="save" />
              <span class="mdi mdi-weather-night"></span> 深色
            </label>
          </div>
        </div>
      </div>

      <div class="section">
        <h2><span class="mdi mdi-database"></span> 索引配置</h2>
        <div class="field">
          <label>大文件阈值 (MB)</label>
          <div class="range-row">
            <input type="range" v-model.number="settings.threshold" min="10" max="1024" step="10" @change="save" class="range-input" />
            <span class="range-value">{{ settings.threshold }} MB</span>
          </div>
          <p class="hint">超过此大小的文件将被跳过索引</p>
        </div>
        <div class="field">
          <div class="checkbox-row">
            <input type="checkbox" id="chk-hidden" v-model="settings.indexHidden" @change="save" />
            <label for="chk-hidden">索引隐藏文件夹</label>
          </div>
          <p class="hint">是否索引以点(.)开头的隐藏文件夹</p>
        </div>
      </div>

      <div class="section">
        <h2><span class="mdi mdi-laptop"></span> 系统配置</h2>
        <div class="field">
          <div class="checkbox-row">
            <input type="checkbox" id="chk-autostart" v-model="settings.autostart" @change="save" />
            <label for="chk-autostart">开机自启动</label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, toRaw } from 'vue'

const emit = defineEmits(['set-theme'])
const props = defineProps<{ theme: string }>()

const settings = reactive({
  theme: '浅色',
  threshold: 100,
  indexHidden: false,
  autostart: false,
})
const toast = ref('')

onMounted(async () => {
  const api = (window as any).api
  if (api) {
    const s = await api.settings.get()
    Object.assign(settings, s)
  }
})

watch(() => settings.theme, (v) => {
  emit('set-theme', v === '深色' ? 'dark' : 'light')
})

const save = async () => {
  const api = (window as any).api
  if (!api) { console.error('[save] api 不可用'); return }
  try {
    const plainSettings = JSON.parse(JSON.stringify(toRaw(settings)))
    api.log(`[SettingsView] save: ${JSON.stringify(plainSettings)}`).catch(() => {})
    await api.settings.update(plainSettings)
    api.log('[SettingsView] 保存成功').catch(() => {})
    toast.value = '设置已保存'
    setTimeout(() => toast.value = '', 2000)
  } catch (e: any) {
    api.log(`[SettingsView] 保存失败: ${e.message}`).catch(() => {})
  }
}
</script>

<style scoped>
.settings-page {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 28px;
}
.header-icon { font-size: 28px; color: var(--primary); }
.page-header h1 { font-size: 22px; font-weight: 700; color: var(--text); }
.sub { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.settings-container {
  max-width: 520px;
}

.section {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
}

.section h2 {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 600; margin-bottom: 16px; color: var(--text);
}

.field { margin-bottom: 16px; }
.field:last-child { margin-bottom: 0; }

.field > label {
  display: block; font-size: 13px; font-weight: 500;
  color: var(--text); margin-bottom: 8px;
}

.radio-group { display: flex; gap: 12px; }

.radio-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; font-size: 14px; color: var(--text);
}
.radio-item.selected { border-color: var(--primary); background: rgba(25, 118, 210, 0.08); }
.radio-item input { display: none; }

.range-row { display: flex; align-items: center; gap: 12px; }
.range-input { flex: 1; height: 6px; accent-color: var(--primary); }
.range-value { font-size: 14px; font-weight: 500; color: var(--primary); min-width: 60px; }

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
  accent-color: var(--primary);
  cursor: pointer;
}

.checkbox-row label {
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  line-height: 1;
}

.hint { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 24px; background: #4caf50; color: #fff; border-radius: 8px; font-size: 14px;
}
</style>
