param(
    [string]$TemplatePath = "C:\Users\ASUS\Downloads\Unit Testing Excel (1)\Unit Testing Excel\Report5_Unit Test Case_v1.2.xlsx",
    [string]$CombinedSourcePath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.2_auth_combined.xlsx"
)

$ErrorActionPreference = "Stop"

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

public class OleMessageFilter : IOleMessageFilter
{
    [DllImport("Ole32.dll")]
    private static extern int CoRegisterMessageFilter(IOleMessageFilter newFilter, out IOleMessageFilter oldFilter);

    public static void Register()
    {
        IOleMessageFilter oldFilter;
        CoRegisterMessageFilter(new OleMessageFilter(), out oldFilter);
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

function Retry-Action {
    param(
        [scriptblock]$Action,
        [int]$MaxAttempts = 20,
        [int]$DelayMs = 1000
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return & $Action
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw
            }
            Start-Sleep -Milliseconds $DelayMs
        }
    }
}

function Copy-FileSharedRead {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    $destinationDir = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null

    $inputStream = [System.IO.File]::Open(
        $SourcePath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
    )

    try {
        $outputStream = [System.IO.File]::Open(
            $DestinationPath,
            [System.IO.FileMode]::Create,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None
        )

        try {
            $inputStream.CopyTo($outputStream)
        }
        finally {
            $outputStream.Dispose()
        }
    }
    finally {
        $inputStream.Dispose()
    }
}

$tempDir = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets"
$stagingTemplatePath = Join-Path $tempDir ("template-v12-" + [guid]::NewGuid().ToString() + ".xlsx")

Copy-FileSharedRead -SourcePath $TemplatePath -DestinationPath $stagingTemplatePath

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputWorkbookPath) | Out-Null
Copy-Item -LiteralPath $stagingTemplatePath -Destination $OutputWorkbookPath -Force

$excel = $null
$templateWorkbook = $null
$sourceWorkbook = $null

try {
    [OleMessageFilter]::Register()
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false
    $excel.EnableEvents = $false
    $excel.AskToUpdateLinks = $false

    Start-Sleep -Milliseconds 2500

    $templateWorkbook = Retry-Action { $excel.Workbooks.Open($OutputWorkbookPath, 0, $false) }
    $sourceWorkbook = Retry-Action { $excel.Workbooks.Open($CombinedSourcePath, 0, $true) }

    while ($templateWorkbook.Worksheets.Count -gt 4) {
        Retry-Action { $templateWorkbook.Worksheets.Item($templateWorkbook.Worksheets.Count).Delete() }
    }

    foreach ($worksheet in @($sourceWorkbook.Worksheets)) {
        Retry-Action { $worksheet.Copy($null, $templateWorkbook.Worksheets.Item($templateWorkbook.Worksheets.Count)) }
    }

    $templateWorkbook.Worksheets.Item(1).Activate() | Out-Null
    Retry-Action { $templateWorkbook.Save() }
}
finally {
    if ($sourceWorkbook -ne $null) {
        try { $sourceWorkbook.Close($false) } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sourceWorkbook)
    }

    if ($templateWorkbook -ne $null) {
        try { $templateWorkbook.Close($true) } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($templateWorkbook)
    }

    if ($excel -ne $null) {
        try { $excel.Quit() } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }

    try { [OleMessageFilter]::Revoke() } catch {}

    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()

    if (Test-Path -LiteralPath $stagingTemplatePath) {
        Remove-Item -LiteralPath $stagingTemplatePath -Force
    }
}

Write-Output "Generated workbook: $OutputWorkbookPath"
