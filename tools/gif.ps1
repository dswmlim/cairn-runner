# Convert a captured screen recording (.webm or .mp4) into docs/gameplay.gif.
# Requires ffmpeg (https://ffmpeg.org) on PATH. Windows PowerShell / pwsh.
#
# Usage:
#   .\tools\gif.ps1 recording.webm
#   .\tools\gif.ps1 recording.mp4 docs\gameplay.gif

param(
  [string]$In  = "recording.webm",
  [string]$Out = "docs\gameplay.gif"
)

$ErrorActionPreference = "Stop"
$fps = 15
$width = 640

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found. Install from https://ffmpeg.org/download.html"
  exit 1
}
if (-not (Test-Path $In)) {
  Write-Error "Input file '$In' not found."
  exit 1
}

$dir = Split-Path $Out -Parent
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

$palette = [System.IO.Path]::GetTempFileName() + ".png"

Write-Host "Generating palette..."
ffmpeg -y -i $In -vf "fps=$fps,scale=${width}:-1:flags=lanczos,palettegen" $palette

Write-Host "Encoding GIF -> $Out ..."
ffmpeg -y -i $In -i $palette -lavfi "fps=$fps,scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse" $Out

Remove-Item $palette -ErrorAction SilentlyContinue
Write-Host "Done: $Out"
