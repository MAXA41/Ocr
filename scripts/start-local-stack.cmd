@echo off
cd /d C:\Users\user\Desktop\ocr\Ocr-1
start "OCR n8n" /min cmd /c "C:\Users\user\Desktop\ocr\Ocr-1\scripts\start-n8n-local.cmd"
start "OCR tunnel" /min cmd /c "C:\Users\user\Desktop\ocr\Ocr-1\scripts\start-telegram-tunnel.cmd"
