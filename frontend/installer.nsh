!macro customUnInstall
  ; 删除 AppData 中的数据
  ; deleteAppDataOnUninstall 配置会自动清理，这里手动清理确保彻底
  RMDir /r "$APPDATA\filepilot"

  ; 清理旧版数据（兼容）
  RMDir /r "$PROFILE\.filepilot"
!macroend
