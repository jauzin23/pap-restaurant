# PowerShell script to count lines of code in PAP Restaurant project
# Excludes default Next.js files and counts only custom code

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PAP Restaurant - Lines of Code Count" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Initialize counters
$jsxTsxLines = 0
$scssLines = 0
$apiJsLines = 0

$jsxTsxFiles = @()
$scssFiles = @()
$apiJsFiles = @()

# Count JSX/TSX files (excluding default Next.js files)
Write-Host "Counting JSX/TSX files..." -ForegroundColor Yellow

$excludedNextJsFiles = @(
    "layout.tsx",
    "not-found.tsx",
    "error.tsx",
    "loading.tsx",
    "template.tsx",
    "default.tsx"
)

Get-ChildItem -Path ".\src" -Include *.jsx,*.tsx -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $fileName = $_.Name
    # Exclude default Next.js files and check if file actually exists
    ($excludedNextJsFiles -notcontains $fileName) -and (Test-Path $_.FullName)
} | ForEach-Object {
    try {
        $lines = (Get-Content $_.FullName -ErrorAction Stop | Measure-Object -Line).Lines
        $jsxTsxLines += $lines
        $jsxTsxFiles += [PSCustomObject]@{
            Path = $_.FullName.Replace((Get-Location).Path + "\", "")
            Lines = $lines
        }
    } catch {
        # Skip files that can't be read
    }
}

# Count SCSS files (custom only - in components and app directories)
Write-Host "Counting SCSS files..." -ForegroundColor Yellow

Get-ChildItem -Path ".\src" -Include *.scss -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    # Only include SCSS files that are clearly custom (not in node_modules, not globals.css related)
    ($_.Name -notmatch "globals") -and ($_.DirectoryName -notmatch "node_modules") -and (Test-Path $_.FullName)
} | ForEach-Object {
    try {
        $lines = (Get-Content $_.FullName -ErrorAction Stop | Measure-Object -Line).Lines
        $scssLines += $lines
        $scssFiles += [PSCustomObject]@{
            Path = $_.FullName.Replace((Get-Location).Path + "\", "")
            Lines = $lines
        }
    } catch {
        # Skip files that can't be read
    }
}

# Count API JS files
Write-Host "Counting API JS files..." -ForegroundColor Yellow

Get-ChildItem -Path ".\api" -Include *.js -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    # Exclude node_modules
    ($_.DirectoryName -notmatch "node_modules") -and (Test-Path $_.FullName)
} | ForEach-Object {
    try {
        $lines = (Get-Content $_.FullName -ErrorAction Stop | Measure-Object -Line).Lines
        $apiJsLines += $lines
        $apiJsFiles += [PSCustomObject]@{
            Path = $_.FullName.Replace((Get-Location).Path + "\", "")
            Lines = $lines
        }
    } catch {
        # Skip files that can't be read
    }
}

# Display results
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  RESULTS" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "JSX/TSX Files (Custom):" -ForegroundColor Cyan
Write-Host "  Files: $($jsxTsxFiles.Count)" -ForegroundColor White
Write-Host "  Lines: $jsxTsxLines" -ForegroundColor White -NoNewline
Write-Host " lines of code`n" -ForegroundColor Gray

Write-Host "SCSS Files (Custom):" -ForegroundColor Cyan
Write-Host "  Files: $($scssFiles.Count)" -ForegroundColor White
Write-Host "  Lines: $scssLines" -ForegroundColor White -NoNewline
Write-Host " lines of code`n" -ForegroundColor Gray

Write-Host "API JS Files:" -ForegroundColor Cyan
Write-Host "  Files: $($apiJsFiles.Count)" -ForegroundColor White
Write-Host "  Lines: $apiJsLines" -ForegroundColor White -NoNewline
Write-Host " lines of code`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  TOTAL: $($jsxTsxLines + $scssLines + $apiJsLines) lines" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# Optional: Show top 10 largest files
Write-Host "`nTop 10 Largest Files:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$allFiles = $jsxTsxFiles + $scssFiles + $apiJsFiles
$allFiles | Sort-Object -Property Lines -Descending | Select-Object -First 10 | ForEach-Object {
    $fileName = Split-Path $_.Path -Leaf
    $directory = Split-Path $_.Path -Parent
    Write-Host "  $($_.Lines) lines" -ForegroundColor White -NoNewline
    Write-Host " - " -ForegroundColor Gray -NoNewline
    Write-Host "$fileName" -ForegroundColor Cyan -NoNewline
    Write-Host " ($directory)" -ForegroundColor DarkGray
}

Write-Host ""
