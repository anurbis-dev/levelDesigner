param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [Parameter(Mandatory = $true)][string]$PidFile,
    [Parameter(Mandatory = $true)][string]$StatusFile,
    [int]$ReadyPort = 47990,
    [int]$MaxWaitSeconds = 90
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile($ImagePath)

$colorBg = [System.Drawing.ColorTranslator]::FromHtml('#111827')
$colorPanelBg = [System.Drawing.ColorTranslator]::FromHtml('#1f2937')
$colorText = [System.Drawing.ColorTranslator]::FromHtml('#d1d5db')
$colorStatus = [System.Drawing.ColorTranslator]::FromHtml('#9ca3af')

$titleHeight = 34
$statusHeight = 26

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.BackColor = $colorBg
$form.ClientSize = New-Object System.Drawing.Size($image.Width, ($image.Height + $titleHeight + $statusHeight))

$screen = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position)
$bounds = $screen.Bounds
$x = $bounds.X + [int](($bounds.Width - $form.ClientSize.Width) / 2)
$y = $bounds.Y + [int](($bounds.Height - $form.ClientSize.Height) / 2)
$form.Location = New-Object System.Drawing.Point($x, $y)

$picture = New-Object System.Windows.Forms.PictureBox
$picture.Image = $image
$picture.SizeMode = 'StretchImage'
$picture.Dock = 'Top'
$picture.Height = $image.Height
$form.Controls.Add($picture)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'HAPLO EDITOR 2D is now loading...'
$titleLabel.Dock = 'Top'
$titleLabel.Height = $titleHeight
$titleLabel.TextAlign = 'MiddleCenter'
$titleLabel.ForeColor = $colorText
$titleLabel.BackColor = $colorPanelBg
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.Controls.Add($titleLabel)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Starting...'
$statusLabel.Dock = 'Bottom'
$statusLabel.Height = $statusHeight
$statusLabel.TextAlign = 'MiddleLeft'
$statusLabel.Padding = New-Object System.Windows.Forms.Padding(8, 0, 8, 0)
$statusLabel.ForeColor = $colorStatus
$statusLabel.BackColor = $colorPanelBg
$statusLabel.Font = New-Object System.Drawing.Font('Consolas', 9)
$statusLabel.AutoEllipsis = $true
$form.Controls.Add($statusLabel)

# Dock stacking follows reverse z-order: the control brought to front LAST ends up flush
# against the true edge. Order here so the picture sits above the title, both above status.
$titleLabel.BringToFront()
$picture.BringToFront()

[System.IO.File]::WriteAllText($PidFile, [System.Diagnostics.Process]::GetCurrentProcess().Id.ToString())

# The splash stays open until the page itself (LevelEditor.finalizeInitialization / index.html
# error paths) pings this loopback socket once it's actually done loading in the browser -
# not just until the browser process starts. A plain TcpListener (not HttpListener) avoids the
# admin-rights/URL-ACL requirement that Windows' http.sys imposes even on localhost prefixes.
$readyListener = $null
try {
    $readyListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $ReadyPort)
    $readyListener.Start()
} catch {
    $readyListener = $null
}
$startTime = Get-Date

$lastStatus = ''
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 200
$timer.Add_Tick({
    try {
        if (Test-Path $StatusFile) {
            $stream = [System.IO.File]::Open($StatusFile, 'Open', 'Read', 'ReadWrite')
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            $lines = $text -split "`r?`n" | Where-Object { $_ -ne '' }
            if ($lines.Count -gt 0) {
                $latest = $lines[-1]
                if ($latest -ne $lastStatus) {
                    $statusLabel.Text = $latest
                    $lastStatus = $latest
                }
            }
        }
    } catch {}
})
$timer.Add_Tick({
    try {
        if ($readyListener -and $readyListener.Pending()) {
            $client = $readyListener.AcceptTcpClient()
            try {
                $responseStream = $client.GetStream()
                $response = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Length: 0`r`nConnection: close`r`n`r`n")
                $responseStream.Write($response, 0, $response.Length)
                $responseStream.Flush()
            } catch {}
            $client.Close()
            $form.Close()
        } elseif (((Get-Date) - $startTime).TotalSeconds -gt $MaxWaitSeconds) {
            $form.Close()
        }
    } catch {}
})
$timer.Start()

$form.Add_FormClosing({
    try { $timer.Stop() } catch {}
    try { if ($readyListener) { $readyListener.Stop() } } catch {}
})

$form.Show()
[System.Windows.Forms.Application]::Run($form)
