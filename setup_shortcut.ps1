$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\LeadHunter Pro AI.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """C:\LeadHunter-Pro-AI\launch.vbs"""
$Shortcut.WindowStyle = 1
$Shortcut.IconLocation = "C:\LeadHunter-Pro-AI\LeadHunter.ico"
$Shortcut.Description = "LeadHunter Pro Ultimate - AI Automated"
$Shortcut.WorkingDirectory = "C:\LeadHunter-Pro-AI"
$Shortcut.Save()
