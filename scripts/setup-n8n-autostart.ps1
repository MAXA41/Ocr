$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\user\Desktop\ocr\Ocr-1'
$task1 = 'OCR_n8n_local'
$task2 = 'OCR_telegram_tunnel'

$action1 = 'cmd /c "cd /d C:\Users\user\Desktop\ocr\Ocr-1 && npm run n8n:start:local"'
$action2 = 'cmd /c "cd /d C:\Users\user\Desktop\ocr\Ocr-1 && timeout /t 25 /nobreak >nul && npm run telegram:tunnel:start"'

schtasks /Create /F /SC ONLOGON /TN $task1 /TR $action1 | Out-Null
schtasks /Create /F /SC ONLOGON /TN $task2 /TR $action2 | Out-Null

Write-Output 'Created tasks:'
Write-Output $task1
Write-Output $task2

schtasks /Query /TN $task1 /FO LIST
schtasks /Query /TN $task2 /FO LIST
