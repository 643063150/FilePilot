<template>
  <div class="about-page">
    <div class="about-header">
      <div class="logo-area">
        <span class="mdi mdi-file-tree logo-icon"></span>
        <h1>FilePilot</h1>
        <p class="version">v{{ version }}</p>
      </div>
    </div>

    <div class="about-content">
      <!-- 软件简介 -->
      <div class="section">
        <h2><span class="mdi mdi-information-outline"></span> 关于软件</h2>
        <p>FilePilot 是一款轻量级的本地文件索引与预览工具，帮助您快速搜索、浏览和预览电脑中的文件。无需打开多个应用程序，一个界面即可查看各种格式的文件内容。</p>
      </div>

      <!-- 开发者信息 -->
      <div class="section">
        <h2><span class="mdi mdi-account-outline"></span> 开发者</h2>
        <div class="dev-info">
          <div class="dev-name">zpp</div>
          <div class="dev-links">
            <a href="#" @click.prevent="openExternal('https://github.com/643063150')" class="dev-link">
              <span class="mdi mdi-github"></span>
              GitHub
            </a>
            <a href="#" @click.prevent="openExternal('https://juejin.cn/user/2911162523457927')" class="dev-link">
              <span class="mdi mdi-post-outline"></span>
              稀土掘金
            </a>
          </div>
        </div>
      </div>

      <!-- 技术栈 -->
      <div class="section">
        <h2><span class="mdi mdi-code-tags"></span> 技术栈</h2>
        <div class="tech-list">
          <span class="tech-tag">Vue 3</span>
          <span class="tech-tag">Vuetify 4</span>
          <span class="tech-tag">Electron</span>
          <span class="tech-tag">SQLite</span>
          <span class="tech-tag">TypeScript</span>
        </div>
      </div>

      <!-- 功能特性 -->
      <div class="section">
        <h2><span class="mdi mdi-star-outline"></span> 功能特性</h2>
        <ul class="feature-list">
          <li>快速文件名搜索</li>
          <li>多格式文件预览（Word、Excel、PDF、Markdown 等）</li>
          <li>浏览器式标签页交互</li>
          <li>文档大纲导航</li>
          <li>Worker 线程池后台转换</li>
          <li>深色/浅色主题切换</li>
        </ul>
      </div>

      <!-- 免责声明 -->
      <div class="section disclaimer">
        <h2><span class="mdi mdi-shield-outline"></span> 免责声明</h2>
        <div class="disclaimer-content">
          <p><strong>本软件完全免费，不存在任何收费行为。</strong></p>
          <p>1. 本软件为开源免费软件，用户可自由下载、使用和分发。</p>
          <p>2. 本软件仅用于本地文件索引和预览，不会上传任何用户数据到云端。</p>
          <p>3. 本软件按"现状"提供，不作任何明示或暗示的保证。</p>
          <p>4. 用户使用本软件所产生的任何后果，由用户自行承担。</p>
          <p>5. 本软件不保证能完全兼容所有文件格式，部分文件可能无法正常预览。</p>
          <p>6. 开发者保留对本软件进行更新、修改或终止服务的权利。</p>
          <p>7. 如本软件涉及第三方库，其版权归原作者所有。</p>
        </div>
      </div>

      <!-- 版权信息 -->
      <div class="section copyright">
        <p>© 2026 zpp. All rights reserved.</p>
        <p class="license">MIT License</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const version = '1.3.1'

const openExternal = (url: string) => {
  const api = (window as any).api
  if (api && api.openExternal) {
    api.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}
</script>

<style scoped>
.about-page {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.about-header,
.about-content {
  width: 100%;
  max-width: 560px;
}

.about-header {
  text-align: center;
  margin-bottom: 32px;
  padding: 32px 0;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 64px;
  color: var(--primary);
}

.about-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.version {
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.section {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.section h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
}

.section p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 8px;
}

.section p:last-child {
  margin-bottom: 0;
}

/* 开发者信息 */
.dev-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dev-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.dev-links {
  display: flex;
  gap: 12px;
}

.dev-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
  font-size: 14px;
  transition: all 0.2s;
}

.dev-link:hover {
  background: var(--hover);
  border-color: var(--primary);
  color: var(--primary);
}

/* 技术栈 */
.tech-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-tag {
  padding: 4px 12px;
  background: rgba(25, 118, 210, 0.1);
  color: var(--primary);
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

/* 功能列表 */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-list li {
  padding: 6px 0;
  font-size: 14px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.feature-list li:last-child {
  border-bottom: none;
}

.feature-list li::before {
  content: '✓';
  color: var(--primary);
  font-weight: 600;
  margin-right: 8px;
}

/* 免责声明 */
.disclaimer {
  background: var(--bg-secondary);
}

.disclaimer-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.disclaimer-content p {
  margin: 0 0 8px;
}

.disclaimer-content strong {
  color: var(--text);
}

/* 版权信息 */
.copyright {
  text-align: center;
  background: transparent;
  border: none;
  padding: 16px 0;
}

.copyright p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.license {
  margin-top: 4px !important;
  font-size: 12px !important;
  opacity: 0.7;
}
</style>
