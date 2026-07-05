<template>
  <v-app :theme="theme">
    <!-- 标题栏 -->
    <div class="titlebar" :class="theme">
      <div class="titlebar-drag">FilePilot</div>
      <div class="titlebar-btns">
        <button @click="minimize">─</button>
        <button @click="maximize">□</button>
        <button class="close" @click="closeWin">✕</button>
      </div>
    </div>

    <div class="layout">
      <!-- 侧边栏 -->
      <nav class="sidebar">
        <div class="nav-top">
          <router-link to="/" class="nav-item" active-class="active" exact>
            <span class="mdi mdi-home"></span>
            <span>首页</span>
          </router-link>
          <router-link to="/folders" class="nav-item" active-class="active">
            <span class="mdi mdi-folder"></span>
            <span>文件夹</span>
          </router-link>
          <router-link to="/settings" class="nav-item" active-class="active">
            <span class="mdi mdi-cog"></span>
            <span>设置</span>
          </router-link>
          <router-link to="/stats" class="nav-item" active-class="active">
            <span class="mdi mdi-chart-pie"></span>
            <span>统计</span>
          </router-link>
        </div>
        <router-link to="/about" class="nav-item nav-bottom" active-class="active">
          <span class="mdi mdi-information-outline"></span>
          <span>关于</span>
        </router-link>
      </nav>

      <!-- 主内容 -->
      <main class="main">
        <router-view :theme="theme" @set-theme="theme = $event" />
      </main>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const theme = ref('light')

const minimize = () => (window as any).api?.window.minimize()
const maximize = () => (window as any).api?.window.maximize()
const closeWin = () => (window as any).api?.window.close()

onMounted(async () => {
  const api = (window as any).api
  if (api) {
    const s = await api.settings.get()
    theme.value = s.theme === '深色' ? 'dark' : 'light'
  }
})

watch(theme, (v) => {
  document.documentElement.setAttribute('data-theme', v)
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; overflow: hidden; }
body { font-family: 'Segoe UI', sans-serif; font-size: 14px; }

/* 浅色主题 */
:root, [data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f5f5f5;
  --text: #333333;
  --text-secondary: #666666;
  --border: #e0e0e0;
  --hover: #f0f0f0;
  --primary: #1976d2;
  --sidebar-bg: #fafafa;
}

/* 深色主题 */
[data-theme="dark"] {
  --bg: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text: #e0e0e0;
  --text-secondary: #aaaaaa;
  --border: #404040;
  --hover: #353535;
  --primary: #64b5f6;
  --sidebar-bg: #252525;
}
</style>

<style scoped>
.titlebar {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
}

.titlebar-drag {
  padding-left: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.titlebar-btns {
  display: flex;
  -webkit-app-region: no-drag;
}

.titlebar-btns button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}

.titlebar-btns button:hover { background: var(--hover); }
.titlebar-btns button.close:hover { background: #e81123; color: #fff; }

.layout {
  display: flex;
  height: calc(100vh - 32px);
}

.sidebar {
  width: 180px;
  min-width: 180px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.nav-top {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-bottom {
  margin-top: auto;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
  font-size: 14px;
  transition: background 0.15s;
}

.nav-item:hover { background: var(--hover); }
.nav-item.active { background: var(--primary); color: #fff; font-weight: 500; }

.main {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  background: var(--bg);
}
</style>
