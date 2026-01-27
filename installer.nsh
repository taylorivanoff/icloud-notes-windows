!macro customInstall
  ; Add to Windows startup
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ; Register protocol handler
  WriteRegStr HKCU "Software\Classes\icloud-notes" "" "URL:iCloud Notes"
  WriteRegStr HKCU "Software\Classes\icloud-notes" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\icloud-notes\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; Remove startup entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes"
  ; Remove protocol handler
  DeleteRegKey HKCU "Software\Classes\icloud-notes"
!macroend
