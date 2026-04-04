param(
    [string]$SourceDir = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\docs\unit",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx"
)

$ErrorActionPreference = "Stop"

if (-not ([System.Management.Automation.PSTypeName]'ExcelMessageFilter').Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("00000016-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IOleMessageFilter
{
    [PreserveSig]
    int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo);

    [PreserveSig]
    int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType);

    [PreserveSig]
    int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType);
}

public class ExcelMessageFilter : IOleMessageFilter
{
    [DllImport("Ole32.dll")]
    private static extern int CoRegisterMessageFilter(IOleMessageFilter newFilter, out IOleMessageFilter oldFilter);

    public static void Register()
    {
        IOleMessageFilter newFilter = new ExcelMessageFilter();
        IOleMessageFilter oldFilter;
        CoRegisterMessageFilter(newFilter, out oldFilter);
    }

    public static void Revoke()
    {
        IOleMessageFilter oldFilter;
        CoRegisterMessageFilter(null, out oldFilter);
    }

    public int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo)
    {
        return 0;
    }

    public int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType)
    {
        if (dwRejectType == 2)
        {
            return 250;
        }

        return -1;
    }

    public int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType)
    {
        return 2;
    }
}
"@
}

$orderedFiles = @(
    "post-auth-register-unit-test.xlsx",
    "get-auth-verify-email-unit-test.xlsx",
    "post-auth-resend-verification-unit-test.xlsx",
    "post-auth-login-unit-test.xlsx",
    "post-auth-logout-unit-test.xlsx",
    "get-auth-profile-unit-test.xlsx",
    "put-auth-profile-unit-test.xlsx",
    "get-auth-session-unit-test.xlsx",
    "post-auth-refresh-unit-test.xlsx",
    "post-auth-forgot-password-unit-test.xlsx",
    "post-auth-verify-otp-unit-test.xlsx",
    "post-auth-reset-password-unit-test.xlsx",
    "get-auth-check-obligations-unit-test.xlsx",
    "post-auth-delete-account-unit-test.xlsx",
    "get-profile-cv-unit-test.xlsx",
    "get-profile-skills-unit-test.xlsx",
    "get-public-skills-domains-unit-test.xlsx",
    "get-public-skills-skills-unit-test.xlsx",
    "get-users-unit-test.xlsx"
)

$outputDir = Split-Path -Parent $OutputWorkbookPath
$tempDir = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets"
$tempWorkbookPath = Join-Path $tempDir (([System.IO.Path]::GetFileNameWithoutExtension($OutputWorkbookPath)) + '-' + [guid]::NewGuid().ToString() + '.xlsx')

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$sourcePaths = foreach ($fileName in $orderedFiles) {
    $fullPath = Join-Path $SourceDir $fileName
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing source workbook: $fullPath"
    }
    $fullPath
}

function Invoke-ExcelRetry {
    param(
        [scriptblock]$Action,
        [int]$MaxAttempts = 20,
        [int]$DelayMilliseconds = 1000
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return & $Action
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw
            }
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
}

if ($sourcePaths.Count -eq 0) {
    throw "No unit test workbooks were found in $SourceDir"
}

Copy-Item -LiteralPath $sourcePaths[0] -Destination $tempWorkbookPath -Force

$excel = $null
$targetWorkbook = $null

try {
    [ExcelMessageFilter]::Register()
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false
    $excel.EnableEvents = $false
    Start-Sleep -Seconds 3

    $targetWorkbook = Invoke-ExcelRetry { $excel.Workbooks.Open($tempWorkbookPath, 0, $false) }

    foreach ($sourcePath in $sourcePaths | Select-Object -Skip 1) {
        $sourceWorkbook = $null
        try {
            $sourceWorkbook = Invoke-ExcelRetry { $excel.Workbooks.Open($sourcePath, 0, $true) }
            $sourceSheet = $sourceWorkbook.Worksheets.Item(1)
            $targetLastSheet = $targetWorkbook.Worksheets.Item($targetWorkbook.Worksheets.Count)
            Invoke-ExcelRetry { $sourceSheet.Copy([Type]::Missing, $targetLastSheet) } | Out-Null
        }
        finally {
            if ($sourceWorkbook) {
                $sourceWorkbook.Close($false)
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sourceWorkbook) | Out-Null
            }
        }
    }

    if (Test-Path -LiteralPath $OutputWorkbookPath) {
        Remove-Item -LiteralPath $OutputWorkbookPath -Force
    }

    Invoke-ExcelRetry { $targetWorkbook.SaveAs($OutputWorkbookPath, 51) } | Out-Null
    $targetWorkbook.Close($true)
}
finally {
    [ExcelMessageFilter]::Revoke()
    if ($targetWorkbook) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($targetWorkbook) | Out-Null
    }
    if ($excel) {
        try {
            $excel.Quit()
        }
        catch {
        }
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }

    if (Test-Path -LiteralPath $tempWorkbookPath) {
        try {
            Remove-Item -LiteralPath $tempWorkbookPath -Force
        }
        catch {
        }
    }

    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Output "Generated workbook: $OutputWorkbookPath"
