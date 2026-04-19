#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Run Terraform even when Cursor's terminal has a stale PATH (common after installing via winget).

.EXAMPLE
  .\tf.ps1 init
  .\tf.ps1 plan -out=tfplan
  .\tf.ps1 apply tfplan
#>
$ErrorActionPreference = "Stop"

function Get-TerraformExe {
  $cmd = Get-Command terraform -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    return $cmd.Source
  }
  $winget = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "terraform.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($winget) {
    return $winget.FullName
  }
  $prog = "C:\Program Files\Terraform\terraform.exe"
  if (Test-Path $prog) {
    return $prog
  }
  return $null
}

# Refresh PATH from Machine + User (fixes many "not recognized" cases in IDE terminals)
$machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$user = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machine;$user"

$exe = Get-TerraformExe
if (-not $exe) {
  Write-Host "terraform.exe not found. Install: winget install Hashicorp.Terraform" -ForegroundColor Red
  exit 1
}

& $exe @args
exit $LASTEXITCODE
