$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "RPN Calculator.lnk"
$AppDir = "c:\Users\karl_\OneDrive\Desktop\rpncalc-web"
$HtmlPath = "file:///$AppDir/index.html"
$IconPath = "$AppDir\rpncalc-source\RPN_Calculator\rpncalculator.ico"

# Look for Chrome or Edge
$TargetExe = ""
if (Test-Path "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") {
    $TargetExe = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
} elseif (Test-Path "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") {
    $TargetExe = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
} elseif (Test-Path "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") {
    $TargetExe = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
} elseif (Test-Path "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") {
    $TargetExe = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
} elseif (Test-Path "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") {
    $TargetExe = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}

if ($TargetExe -ne "") {
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetExe
    $Shortcut.Arguments = "--app=`"$HtmlPath`" --window-size=485,620"
    $Shortcut.WorkingDirectory = $AppDir
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
    }
    $Shortcut.Description = "RPN Calculator Desktop App"
    $Shortcut.Save()
    Write-Host "Created Desktop shortcut at: $ShortcutPath"
} else {
    Write-Host "Could not locate Chrome or Edge executable."
}
