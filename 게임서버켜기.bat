@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 사전 서버를 켜는 중입니다...
echo 이 창을 닫으면 게임의 실시간 사전 연동이 꺼집니다.
echo.
npm start
pause
