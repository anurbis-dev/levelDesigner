# PowerShell script to safely get git logs without pager issues
# Usage: .\get_git_logs.ps1 [number_of_commits] [output_file]

# Change to script directory
Set-Location $PSScriptRoot

param(
    [int]$Commits = 10,
    [string]$OutputFile = "git_logs.txt"
)

# Disable pager for git commands
$env:GIT_PAGER = "cat"

try {
    # Get git log with specified number of commits
    $gitLog = git log --oneline -n $Commits 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # Write to file
        $gitLog | Out-File -FilePath $OutputFile -Encoding UTF8
        
        # Also output to console for immediate viewing
        Write-Host "Git logs (last $Commits commits):" -ForegroundColor Green
        $gitLog | ForEach-Object { Write-Host $_ }
        
        Write-Host "`nLogs saved to: $OutputFile" -ForegroundColor Yellow
    } else {
        Write-Error "Git command failed: $gitLog"
        exit 1
    }
} catch {
    Write-Error "Error getting git logs: $($_.Exception.Message)"
    exit 1
}
