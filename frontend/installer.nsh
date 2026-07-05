!macro customUnInstall
  ; 直接删除所有数据，不询问
  ; 数据位置: {安装目录}\data
  ; 缓存位置: %APPDATA%\filepilot
  RMDir /r "$INSTDIR\data"
  RMDir /r "$APPDATA\filepilot"
  RMDir /r "$PROFILE\.filepilot"
!macroend
