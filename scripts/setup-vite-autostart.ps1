$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\user\Desktop\ocr\Ocr-1'
$taskName = 'OCR_vite_dev'
$action = 'cmd.exe /c "cd /d ' + $repo + ' && npm run dev -- --host 0.0.0.0"'

schtasks /Create /F /SC ONLOGON /TN $taskName /TR $action | Out-Null
Write-Output "Created scheduled task: $taskName"

schtasks /Query /TN $taskName /FO LIST
