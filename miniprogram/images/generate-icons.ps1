Add-Type -AssemblyName System.Drawing

function New-DotIcon {
    param(
        [string]$FilePath,
        [int]$R, [int]$G, [int]$B,
        [int]$Size = 81,
        [int]$DotDiameter = 40
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $R, $G, $B))
    $x = [int](($Size - $DotDiameter) / 2)
    $y = [int](($Size - $DotDiameter) / 2)
    $g.FillEllipse($brush, $x, $y, $DotDiameter, $DotDiameter)

    $bmp.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $brush.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $FilePath"
}

$base = "C:\Users\jack\Desktop\medicine-reminder\miniprogram\images"

# Unselected gray (#999999)
New-DotIcon "$base\home.png"          0x99 0x99 0x99
New-DotIcon "$base\medicine.png"      0x99 0x99 0x99
New-DotIcon "$base\record.png"        0x99 0x99 0x99
New-DotIcon "$base\chart.png"         0x99 0x99 0x99

# Selected colors
New-DotIcon "$base\home-active.png"       0x63 0x66 0xF1
New-DotIcon "$base\medicine-active.png"   0x48 0xBB 0x78
New-DotIcon "$base\record-active.png"     0xED 0x89 0x36
New-DotIcon "$base\chart-active.png"      0x42 0x99 0xE1

Write-Host ""
Write-Host "All 8 icons generated successfully!"
Get-ChildItem $base -Filter "*.png" | ForEach-Object {
    Write-Host "$($_.Name)  $($_.Length) bytes"
}
