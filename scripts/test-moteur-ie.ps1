# Charge une page dans le moteur Internet Explorer 11 de Windows (celui des anciens PowerPoint),
# affiche le texte rendu et enregistre une capture. Exemple :
#   powershell -STA -File scripts/test-moteur-ie.ps1 -Url "http://localhost:3100/addin/legacy.html?url=..." -Png ie.png
param([string]$Url, [string]$Png)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$f = New-Object System.Windows.Forms.Form
$f.Width = 1296; $f.Height = 759; $f.ShowInTaskbar = $false
$f.StartPosition = 'Manual'; $f.Location = New-Object System.Drawing.Point(-3000, 0)
$wb = New-Object System.Windows.Forms.WebBrowser
$wb.Dock = 'Fill'; $wb.ScriptErrorsSuppressed = $true
$f.Controls.Add($wb)
$f.Show()
$wb.Navigate($Url)
$t = [DateTime]::Now
while (([DateTime]::Now - $t).TotalSeconds -lt 10) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 50 }
$doc = $wb.Document
$mode = $doc.InvokeScript('eval', @('document.documentMode'))
$ua = $doc.InvokeScript('eval', @('navigator.userAgent'))
$text = $doc.InvokeScript('eval', @('document.body.innerText'))
Write-Output ("URL finale : " + $wb.Url)
Write-Output ("Mode document : " + $mode)
Write-Output ("Moteur : " + $ua)
Write-Output ("Texte : " + ($text -replace '\s+', ' '))
$bmp = New-Object System.Drawing.Bitmap 1280, 720
$wb.DrawToBitmap($bmp, (New-Object System.Drawing.Rectangle 0, 0, 1280, 720))
$bmp.Save($Png)
$f.Close()
