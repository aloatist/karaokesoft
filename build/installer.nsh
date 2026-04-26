!include "nsProcess.nsh"

!macro customCheckAppRunning
  DetailPrint "Checking for running ${PRODUCT_NAME} processes..."

  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    DetailPrint "Closing ${PRODUCT_NAME} before install..."

    nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R1
    Sleep 1500

    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      DetailPrint "${PRODUCT_NAME} is still running, retrying forced close..."
      nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
      Pop $R1
      Sleep 2000

      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 == 0
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retry_force_close
        Quit

        retry_force_close:
          nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
          Pop $R1
          Sleep 2000
          ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
          ${If} $R0 == 0
            Quit
          ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  DetailPrint "Adding Windows Firewall rules for ${PRODUCT_NAME}..."
  nsExec::ExecToLog `netsh advfirewall firewall delete rule name="KaraokeYT App"`
  nsExec::ExecToLog `netsh advfirewall firewall delete rule name="KaraokeYT Relay TCP"`
  nsExec::ExecToLog `netsh advfirewall firewall add rule name="KaraokeYT App" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=private,domain`
  nsExec::ExecToLog `netsh advfirewall firewall add rule name="KaraokeYT Relay TCP" dir=in action=allow protocol=TCP localport=8787,8790-8799 enable=yes profile=private,domain`
!macroend

!macro customUnInstall
  DetailPrint "Removing Windows Firewall rules for ${PRODUCT_NAME}..."
  nsExec::ExecToLog `netsh advfirewall firewall delete rule name="KaraokeYT App"`
  nsExec::ExecToLog `netsh advfirewall firewall delete rule name="KaraokeYT Relay TCP"`
!macroend
