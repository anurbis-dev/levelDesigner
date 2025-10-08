# Script to scan content folder and update manifest.json
# Finds all JSON files (except manifest.json itself) and updates the manifest

$contentPath = ".\content"
$manifestPath = "$contentPath\manifest.json"

Write-Host "Scanning content folder for JSON files..." -ForegroundColor Cyan

# Find all JSON files except manifest.json
$jsonFiles = Get-ChildItem -Path $contentPath -Filter "*.json" -Recurse -File | 
    Where-Object { $_.Name -ne "manifest.json" } |
    ForEach-Object {
        # Get relative path from content folder
        $relativePath = $_.FullName.Substring($contentPath.Length + 1).Replace('\', '/')
        $relativePath
    }

Write-Host "Found $($jsonFiles.Count) JSON files" -ForegroundColor Green

# Load existing manifest
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    Write-Host "Loaded existing manifest" -ForegroundColor Green
} else {
    Write-Host "Manifest not found, creating new one" -ForegroundColor Yellow
    $manifest = @{
        version = "1.0.0"
        generated = (Get-Date -Format "yyyy-MM-dd")
        structure = @{
            assets = @{}
            graphs = @{}
            maps = @{}
        }
        files = @()
    }
}

# Update files list
$manifest.files = @($jsonFiles)
$manifest.generated = Get-Date -Format "yyyy-MM-dd"

# Save manifest
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

Write-Host "Manifest updated successfully!" -ForegroundColor Green
Write-Host "Files in manifest: $($manifest.files.Count)" -ForegroundColor Cyan

# Display files
if ($manifest.files.Count -gt 0) {
    Write-Host "`nJSON files in manifest:" -ForegroundColor Cyan
    $manifest.files | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
} else {
    Write-Host "`nNo JSON asset files found in content folder" -ForegroundColor Yellow
    Write-Host "Add JSON files to content subfolders and run this script again" -ForegroundColor Yellow
}
