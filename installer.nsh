!macro customInstall
  ; Add to Windows startup by default
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

!macro customUnInstall
  ; Remove startup registry entry on uninstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes"
!macroend
