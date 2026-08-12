; Startup + icloud-notes:// protocol (parity with Electron installer.nsh)

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes" '"$INSTDIR\iCloud Notes.exe"'
  WriteRegStr HKCU "Software\Classes\icloud-notes" "" "URL:iCloud Notes"
  WriteRegStr HKCU "Software\Classes\icloud-notes" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\icloud-notes\shell\open\command" "" '"$INSTDIR\iCloud Notes.exe" "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "iCloud Notes"
  DeleteRegKey HKCU "Software\Classes\icloud-notes"
!macroend
