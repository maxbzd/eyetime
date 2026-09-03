Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
pyScript = FSO.BuildPath(scriptDir, "eyetime_tracker.py")
pyExe = "C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\pythonw.exe"

WshShell.Run """" & pyExe & """ """ & pyScript & """", 0, False
