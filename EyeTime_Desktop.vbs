Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

chromeDir = "C:\Users\maxbz\Downloads\chrome"
trackerDir = chromeDir & "\desktop_tracker"
WshShell.CurrentDirectory = trackerDir

pyExe = "C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\pythonw.exe"
trackerPy = trackerDir & "\eyetime_tracker.py"

' Start Python background tracker silently
WshShell.Run """" & pyExe & """ """ & trackerPy & """", 0, False

WScript.Sleep 1200

' Find Browser (Chrome or Edge)
browserExe = ""
If FSO.FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    browserExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
ElseIf FSO.FileExists("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") Then
    browserExe = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ElseIf FSO.FileExists("C:\Program Files\Microsoft\Edge\Application\msedge.exe") Then
    browserExe = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

' Launch Desktop App Window
If browserExe <> "" Then
    appArgs = "--app=""http://127.0.0.1:8765/app"" --window-size=1200,820 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\EyeTimeDesktop"""
    WshShell.Run """" & browserExe & """ " & appArgs, 1, False
Else
    WshShell.Run "http://127.0.0.1:8765/app", 1, False
End If
