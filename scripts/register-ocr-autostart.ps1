$ErrorActionPreference = 'Stop'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$action1 = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "C:\Users\user\Desktop\ocr\Ocr-1\scripts\start-n8n-local.cmd"'
Register-ScheduledTask -TaskName 'OCR_n8n_local' -Action $action1 -Trigger $trigger -Force | Out-Null
$action2 = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "C:\Users\user\Desktop\ocr\Ocr-1\scripts\start-telegram-tunnel.cmd"'
Register-ScheduledTask -TaskName 'OCR_telegram_tunnel' -Action $action2 -Trigger $trigger -Force | Out-Null
Get-ScheduledTask -TaskName 'OCR_n8n_local','OCR_telegram_tunnel' | Select-Object TaskName,State,TaskPath | Format-Table -AutoSize
