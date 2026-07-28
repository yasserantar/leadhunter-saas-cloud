@echo off
cd /d "C:\LeadHunter-Pro-AI"
echo Starting LeadHunter Pro AI Server... > output.log
start "" "http://localhost:3000"
node server/index.js >> output.log 2>&1
