<#
.SYNOPSIS
  Generates every shipped image from the master logo.

.DESCRIPTION
  The master art is a 1254x1254 PNG of about 2.4 MB — heavier on its own than the
  entire built application. This produces the handful of sized derivatives the app
  actually serves, so the master never has to be committed or shipped.

  Uses System.Drawing rather than a build-time image plugin: it is already on the
  machine, and these outputs change only when the artwork does, which is far less
  often than the code. Run it by hand and commit the results.

.PARAMETER Source
  The transparent master. Transparency matters for the tab icon and for the badge
  sitting on either theme; the flattened copy of the same art cannot do either.

.EXAMPLE
  pwsh scripts/build-logo-assets.ps1 -Source "$env:USERPROFILE\Pictures\Downloads\logo no bg.png"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Source,

  [string]$OutDir = (Join-Path $PSScriptRoot '..\public')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { throw "Source image not found: $Source" }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

# The app's felt, so the link-preview card matches the game rather than the
# different green baked into the flattened master.
$Felt = [System.Drawing.ColorTranslator]::FromHtml('#071411')

$master = [System.Drawing.Image]::FromFile($Source)

<#
  Draws $master into a new bitmap at the requested size.

  HighQualityBicubic plus HighQuality smoothing is what keeps the fine gold
  lettering from turning to mush at small sizes. `PixelOffsetMode = HighQuality`
  removes the half-pixel drift that otherwise softens edges on downscale.
#>
function New-Canvas {
  param(
    [int]$Width,
    [int]$Height,
    [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent
  )

  $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear($Background)
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Square {
  param([int]$Size, [string]$Name)

  $c = New-Canvas -Width $Size -Height $Size
  $c.Graphics.DrawImage($master, 0, 0, $Size, $Size)
  $path = Join-Path $OutDir $Name
  $c.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Graphics.Dispose(); $c.Bitmap.Dispose()
  return $path
}

<#
  Cuts a tab icon from the badge's centre tile rather than shrinking the whole
  logo.

  Unused by default — see the note above `favicon-32.png` / `favicon-16.png`
  below, which are now hand-picked artwork rather than a crop of the badge.
  Kept here as the fallback this script reaches for if no curated favicon exists
  yet.

  The full badge is legible down to about 180px, but at 32 it collapses into an
  indistinct green disc — the lettering and the fan of tiles are simply gone. The
  centre tile survives the same reduction as a recognisable mahjong tile, which is
  a far better mark for a tab strip: a favicon needs to be identifiable, not
  complete.

  The region is square in source pixels so the tile keeps its proportions.
#>
function Save-TileIcon {
  param([int]$Size, [string]$Name)

  $side = [int]($master.Width * 0.23)
  $src = New-Object System.Drawing.Rectangle(
    [int]($master.Width * 0.5 - $side / 2), [int]($master.Height * 0.135), $side, $side)

  $c = New-Canvas -Width $Size -Height $Size
  $c.Graphics.DrawImage($master,
    (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
    $src, [System.Drawing.GraphicsUnit]::Pixel)

  $path = Join-Path $OutDir $Name
  $c.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Graphics.Dispose(); $c.Bitmap.Dispose()
  return $path
}

function Save-Preview {
  param([int]$Width, [int]$Height, [string]$Name, [int]$Quality = 82)

  # Badge centred at ~86% of the card's height, leaving it room to breathe.
  $side = [int]($Height * 0.86)
  $x = [int](($Width - $side) / 2)
  $y = [int](($Height - $side) / 2)

  $c = New-Canvas -Width $Width -Height $Height -Background $Felt
  $c.Graphics.DrawImage($master, $x, $y, $side, $side)

  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

  $path = Join-Path $OutDir $Name
  $c.Bitmap.Save($path, $encoder, $params)
  $c.Graphics.Dispose(); $c.Bitmap.Dispose()
  return $path
}

$written = @()
# 320 rather than 400: the masthead is height-capped near 150px so this is still
# comfortably 2x, and 400 came out at 267 KB — most of the page's weight for
# detail nothing renders.
$written += Save-Square -Size 320 -Name 'logo.png'            # masthead + summary, at 2x
$written += Save-Square -Size 180 -Name 'apple-touch-icon.png'  # whole badge still reads here

<#
  favicon-32.png / favicon-16.png are hand-picked artwork, not a crop of the
  master — they are chosen and dropped into public/ directly, not regenerated
  here. Re-running this script must not silently overwrite that choice with the
  auto-cropped tile icon, so it only fills them in the first time, when there is
  nothing there yet to lose.
#>
foreach ($size in 32, 16) {
  $name = "favicon-$size.png"
  $path = Join-Path $OutDir $name
  if (Test-Path $path) {
    Write-Host "Skipping $name — curated artwork already in public/, not regenerating."
  } else {
    $written += Save-TileIcon -Size $size -Name $name
  }
}

$written += Save-Preview -Width 1200 -Height 630 -Name 'og.jpg'

$master.Dispose()

$written | ForEach-Object {
  $item = Get-Item $_
  [PSCustomObject]@{ File = $item.Name; KB = [math]::Round($item.Length / 1KB, 1) }
} | Format-Table -AutoSize
