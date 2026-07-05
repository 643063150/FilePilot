# FilePilot 清理检查清单规则

> 本规则用于确保卸载/重装时正确清理所有相关数据

## 核心原则

**从代码找路径，不是从测试环境找路径。**

---

## 正确做法

### 1. 从代码分析数据存储位置

```bash
# 搜索所有文件路径相关代码
grep -rn "getPath\|userData\|APPDATA\|filepilot" electron/
```

### 2. Electron 数据位置

```javascript
// electron/main.cjs
app.getPath('userData')
// 等价于: %APPDATA%\{appName}
// 实际路径: C:\Users\{username}\AppData\Roaming\filepilot
```

### 3. NSIS 变量对照

| 代码 | NSIS 变量 | 说明 |
|------|-----------|------|
| `app.getPath('userData')` | `$APPDATA\filepilot` | 用户数据目录 |
| `os.homedir()` | `$PROFILE` | 用户主目录 |

---

## 必须清理的位置

| 位置 | NSIS 路径 | 包含内容 |
|------|-----------|----------|
| Electron 数据 | `$APPDATA\filepilot` | 数据库、缓存、设置 |
| 旧版数据 | `$PROFILE\.filepilot` | 旧版数据库（兼容） |

---

## 清理脚本模板

```nsis
!macro customUnInstall
  MessageBox MB_YESNO "是否删除所有数据？" IDYES deleteData IDNO keepData

  deleteData:
    RMDir /r "$APPDATA\filepilot"
    RMDir /r "$PROFILE\.filepilot"
    Goto done

  keepData:
    Goto done

  done:
!macroend
```

---

## 检查流程

1. **开发时**：添加新的数据存储 → 更新清理脚本
2. **构建前**：验证 `installer.nsh` 包含所有路径
3. **测试时**：安装 → 添加数据 → 卸载 → 验证数据已删除

---

## 禁止事项

1. ❌ 用 `find` 命令在测试环境找路径
2. ❌ 硬编码用户名
3. ❌ 假设测试环境和用户环境一致
4. ❌ 只测试安装不测试卸载

---

**创建时间**: 2026-07-05
**触发原因**: 错误地在测试环境查找缓存位置，而非从代码分析
