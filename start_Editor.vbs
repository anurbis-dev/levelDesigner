' Zero-flash launcher: wscript.exe has no console window at all,
' unlike start_Editor.bat which briefly flashes cmd.exe before it self-relaunches hidden.
Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ws.Run "cmd /c """ & scriptDir & "\start_Editor.bat"" hidden", 0, False
