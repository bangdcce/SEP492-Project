param(
    [string]$SourcePath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx",
    [string]$TargetPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.2_combined.xlsx"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$sheetNames = @(
    "Register Account","Verify Email","Resend Verification","Login","Logout","Get Profile",
    "Update Profile","Get Session","Refresh Token","Forgot Password","Verify OTP",
    "Reset Password","Check Obligations","Delete Account","Get CV","Get Skills",
    "Delete CV","Update Bio","Update Skills","Submit KYC","Get My KYC",
    "Get All KYC","Get KYC By ID","Get KYC By ID With Watermark",
    "Approve KYC","Reject KYC",
    "Get Public Domains","Get Public Skills","Get Users",
    "Get User Detail","Ban User","Unban User"
)

function Copy-FileSharedRead {
    param([string]$SourcePath,[string]$DestinationPath)
    $in = [System.IO.File]::Open($SourcePath,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite)
    try {
        $out = [System.IO.File]::Open($DestinationPath,[System.IO.FileMode]::Create,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
        try { $in.CopyTo($out) } finally { $out.Dispose() }
    } finally { $in.Dispose() }
}

function Get-Text {
    param($Si)
    if ($null -eq $Si) { return "" }
    if ($Si.t) { return [string]$Si.t }
    if ($Si.r) {
        $text = ""
        foreach ($run in $Si.r) {
            if ($run.t -is [string]) { $text += $run.t }
            elseif ($run.t.'#text') { $text += $run.t.'#text' }
        }
        return $text
    }
    if ($Si.'#text') { return [string]$Si.'#text' }
    return ""
}

function Get-CellText {
    param($Cell,$SharedValues,$Ns)
    if ($null -eq $Cell) { return "" }
    $type = $Cell.GetAttribute("t")
    if ($type -eq "s") {
        $valueNode = $Cell.SelectSingleNode("x:v",$Ns)
        if ($valueNode -ne $null) { return $SharedValues[[int]$valueNode.InnerText] }
        return ""
    }
    if ($type -eq "inlineStr") {
        $textNode = $Cell.SelectSingleNode("x:is/x:t",$Ns)
        if ($textNode -ne $null) { return [string]$textNode.InnerText }
        return ""
    }
    $valueNode = $Cell.SelectSingleNode("x:v",$Ns)
    if ($valueNode -ne $null) { return [string]$valueNode.InnerText }
    return ""
}

function Get-ColumnLetters {
    param([string]$Reference)
    return ([regex]::Match($Reference,'^[A-Z]+')).Value
}

function Get-ColumnIndex {
    param([string]$Letters)
    $value = 0
    foreach ($char in $Letters.ToCharArray()) {
        $value = ($value * 26) + ([int][char]$char - [int][char]'A' + 1)
    }
    return $value
}

function Get-ColumnLettersFromIndex {
    param([int]$Index)
    $letters = ""
    while ($Index -gt 0) {
        $remainder = ($Index - 1) % 26
        $letters = [char]([int][char]'A' + $remainder) + $letters
        $Index = [math]::Floor(($Index - 1) / 26)
    }
    return $letters
}

function Clear-Cell {
    param($Cell)
    foreach ($child in @($Cell.ChildNodes)) { [void]$Cell.RemoveChild($child) }
    if ($Cell.HasAttribute("t")) { $Cell.RemoveAttribute("t") }
}

function Get-OrCreateCell {
    param($SheetXml,$Row,$Ns,[string]$ColumnLetters,[string]$StyleId)
    $reference = $ColumnLetters + $Row.GetAttribute("r")
    foreach ($cell in $Row.SelectNodes("x:c",$Ns)) {
        if ($cell.GetAttribute("r") -eq $reference) { return $cell }
    }
    $cell = $SheetXml.CreateElement("c",$SheetXml.DocumentElement.NamespaceURI)
    $cell.SetAttribute("r",$reference)
    if ($StyleId) { $cell.SetAttribute("s",$StyleId) }
    $newIndex = Get-ColumnIndex $ColumnLetters
    $inserted = $false
    foreach ($existingCell in @($Row.SelectNodes("x:c",$Ns))) {
        $existingIndex = Get-ColumnIndex (Get-ColumnLetters $existingCell.GetAttribute("r"))
        if ($existingIndex -gt $newIndex) {
            [void]$Row.InsertBefore($cell,$existingCell)
            $inserted = $true
            break
        }
    }
    if (-not $inserted) { [void]$Row.AppendChild($cell) }
    return $cell
}

function Set-CellText {
    param($SheetXml,$Row,$Ns,[string]$ColumnLetters,[string]$Text,[string]$StyleId)
    $cell = Get-OrCreateCell $SheetXml $Row $Ns $ColumnLetters $StyleId
    Clear-Cell $cell
    if ($StyleId) { $cell.SetAttribute("s",$StyleId) }
    $cell.SetAttribute("t","inlineStr")
    $isNode = $SheetXml.CreateElement("is",$SheetXml.DocumentElement.NamespaceURI)
    $tNode = $SheetXml.CreateElement("t",$SheetXml.DocumentElement.NamespaceURI)
    $tNode.InnerText = $Text
    [void]$isNode.AppendChild($tNode)
    [void]$cell.AppendChild($isNode)
}

$workDir = Join-Path "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets" ("sync-footer-" + [guid]::NewGuid().ToString())
$srcDir = Join-Path $workDir "src"
$dstDir = Join-Path $workDir "dst"
$targetCopy = Join-Path $workDir "target.xlsx"
$zipPath = Join-Path $workDir "out.zip"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Copy-FileSharedRead -SourcePath $TargetPath -DestinationPath $targetCopy

[System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath,$srcDir)
[System.IO.Compression.ZipFile]::ExtractToDirectory($targetCopy,$dstDir)

[xml]$srcWorkbookXml = [System.IO.File]::ReadAllText((Join-Path $srcDir "xl\workbook.xml"))
[xml]$srcWorkbookRelsXml = [System.IO.File]::ReadAllText((Join-Path $srcDir "xl\_rels\workbook.xml.rels"))
[xml]$srcSharedXml = [System.IO.File]::ReadAllText((Join-Path $srcDir "xl\sharedStrings.xml"))
[xml]$dstWorkbookXml = [System.IO.File]::ReadAllText((Join-Path $dstDir "xl\workbook.xml"))
[xml]$dstWorkbookRelsXml = [System.IO.File]::ReadAllText((Join-Path $dstDir "xl\_rels\workbook.xml.rels"))
$dstSharedPath = Join-Path $dstDir "xl\sharedStrings.xml"

$srcSharedValues = @()
foreach ($si in $srcSharedXml.sst.si) { $srcSharedValues += (Get-Text $si) }
$dstSharedValues = @()
if (Test-Path -LiteralPath $dstSharedPath) {
    [xml]$dstSharedXml = [System.IO.File]::ReadAllText($dstSharedPath)
    foreach ($si in $dstSharedXml.sst.si) { $dstSharedValues += (Get-Text $si) }
}

$srcNs = New-Object System.Xml.XmlNamespaceManager($srcWorkbookXml.NameTable)
$srcNs.AddNamespace("x",$srcWorkbookXml.DocumentElement.NamespaceURI)
$srcRelNs = New-Object System.Xml.XmlNamespaceManager($srcWorkbookRelsXml.NameTable)
$srcRelNs.AddNamespace("x",$srcWorkbookRelsXml.DocumentElement.NamespaceURI)
$dstNs = New-Object System.Xml.XmlNamespaceManager($dstWorkbookXml.NameTable)
$dstNs.AddNamespace("x",$dstWorkbookXml.DocumentElement.NamespaceURI)
$dstRelNs = New-Object System.Xml.XmlNamespaceManager($dstWorkbookRelsXml.NameTable)
$dstRelNs.AddNamespace("x",$dstWorkbookRelsXml.DocumentElement.NamespaceURI)

foreach ($sheetName in $sheetNames) {
    $srcSheet = $srcWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='$sheetName']",$srcNs)
    $dstSheet = $dstWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='$sheetName']",$dstNs)
    if ($srcSheet -eq $null -or $dstSheet -eq $null) { continue }

    $srcSheetRelId = $srcSheet.GetAttribute("id","http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $dstSheetRelId = $dstSheet.GetAttribute("id","http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $srcSheetRel = $srcWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$srcSheetRelId']",$srcRelNs)
    $dstSheetRel = $dstWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$dstSheetRelId']",$dstRelNs)

    [xml]$srcSheetXml = [System.IO.File]::ReadAllText((Join-Path $srcDir ("xl\" + $srcSheetRel.GetAttribute("Target").Replace('/','\'))))
    [xml]$dstSheetXml = [System.IO.File]::ReadAllText((Join-Path $dstDir ("xl\" + $dstSheetRel.GetAttribute("Target").Replace('/','\'))))

    $srcSheetNs = New-Object System.Xml.XmlNamespaceManager($srcSheetXml.NameTable)
    $srcSheetNs.AddNamespace("x",$srcSheetXml.DocumentElement.NamespaceURI)
    $dstSheetNs = New-Object System.Xml.XmlNamespaceManager($dstSheetXml.NameTable)
    $dstSheetNs.AddNamespace("x",$dstSheetXml.DocumentElement.NamespaceURI)

    $srcUtcColumns = @()
    foreach ($cell in $srcSheetXml.SelectNodes("//x:row[@r='9']/x:c",$srcSheetNs)) {
        $text = Get-CellText $cell $srcSharedValues $srcSheetNs
        if ($text -like "UTCID*") { $srcUtcColumns += (Get-ColumnLetters $cell.GetAttribute("r")) }
    }

    $dstUtcColumns = @()
    for ($i = 0; $i -lt $srcUtcColumns.Count; $i++) {
        $dstUtcColumns += (Get-ColumnLettersFromIndex (6 + $i))
    }

    $srcRows = @{}
    foreach ($row in $srcSheetXml.SelectNodes("//x:sheetData/x:row",$srcSheetNs)) {
        $srcRows[[int]$row.GetAttribute("r")] = $row
    }
    $dstRows = @{}
    foreach ($row in $dstSheetXml.SelectNodes("//x:sheetData/x:row",$dstSheetNs)) {
        $dstRows[[int]$row.GetAttribute("r")] = $row
    }

    $srcResultRow = $null
    foreach ($rowNumber in ($srcRows.Keys | Sort-Object)) {
        $cell = $srcRows[$rowNumber].SelectSingleNode("x:c[starts-with(@r,'A')]",$srcSheetNs)
        if ((Get-CellText $cell $srcSharedValues $srcSheetNs) -eq "Result") {
            $srcResultRow = $rowNumber
            break
        }
    }
    $dstResultRow = $null
    foreach ($rowNumber in ($dstRows.Keys | Sort-Object)) {
        $cell = $dstRows[$rowNumber].SelectSingleNode("x:c[starts-with(@r,'A')]",$dstSheetNs)
        if ((Get-CellText $cell $dstSharedValues $dstSheetNs) -eq "Result") {
            $dstResultRow = $rowNumber
            break
        }
    }
    if ($null -eq $srcResultRow -or $null -eq $dstResultRow) { continue }

    $footerRowMap = @(
        @{ Label = "Type(N : Normal, A : Abnormal, B : Boundary)"; Key = "types"; Style = "188" },
        @{ Label = "Passed/Failed"; Key = "status"; Style = "94" },
        @{ Label = "Executed Date"; Key = "dates"; Style = "97" },
        @{ Label = "Defect ID"; Key = "defects"; Style = "179" }
    )

    $copiedFooterValues = @{}
    foreach ($entry in $footerRowMap) {
        $srcFooterRow = $null
        foreach ($candidate in ($srcResultRow..($srcResultRow + 6))) {
            if (-not $srcRows.ContainsKey($candidate)) { continue }
            $labelCell = $srcRows[$candidate].SelectSingleNode("x:c[starts-with(@r,'B')]",$srcSheetNs)
            $labelText = Get-CellText $labelCell $srcSharedValues $srcSheetNs
            if ($labelText -eq $entry.Label) {
                $srcFooterRow = $srcRows[$candidate]
                break
            }
        }

        $dstFooterRow = $null
        foreach ($candidate in ($dstResultRow..($dstResultRow + 6))) {
            if (-not $dstRows.ContainsKey($candidate)) { continue }
            $labelCell = $dstRows[$candidate].SelectSingleNode("x:c[starts-with(@r,'B')]",$dstSheetNs)
            $labelText = Get-CellText $labelCell $dstSharedValues $dstSheetNs
            if ($labelText -eq $entry.Label) {
                $dstFooterRow = $dstRows[$candidate]
                break
            }
        }

        if ($null -eq $srcFooterRow -or $null -eq $dstFooterRow) { continue }

        $rowValues = @()
        for ($i = 0; $i -lt [Math]::Min($srcUtcColumns.Count,$dstUtcColumns.Count); $i++) {
            $srcCell = $srcFooterRow.SelectSingleNode("x:c[starts-with(@r,'$($srcUtcColumns[$i])')]",$srcSheetNs)
            $value = Get-CellText $srcCell $srcSharedValues $srcSheetNs
            $rowValues += $value
            if ($value -eq "") { continue }
            Set-CellText $dstSheetXml $dstFooterRow $dstSheetNs $dstUtcColumns[$i] $value $entry.Style
        }
        $copiedFooterValues[$entry.Key] = $rowValues
    }

    $typeValues = @()
    foreach ($value in @($copiedFooterValues["types"])) { $typeValues += [string]$value }
    $statusValues = @()
    foreach ($value in @($copiedFooterValues["status"])) { $statusValues += [string]$value }
    if ($typeValues.Count -eq 0 -and $statusValues.Count -eq 0) {
        $dstSheetXml.Save((Join-Path $dstDir ("xl\" + $dstSheetRel.GetAttribute("Target").Replace('/','\'))))
        continue
    }

    $passedCount = (@($statusValues | Where-Object { ([string]$_).Trim() -eq 'P' })).Count
    $failedCount = (@($statusValues | Where-Object { ([string]$_).Trim() -eq 'F' })).Count
    $untestedCount = (@($statusValues | Where-Object { ([string]$_).Trim() -eq '' })).Count
    $nCount = (@($typeValues | Where-Object { ([string]$_).Trim() -eq 'N' })).Count
    $aCount = (@($typeValues | Where-Object { ([string]$_).Trim() -eq 'A' })).Count
    $bCount = (@($typeValues | Where-Object { ([string]$_).Trim() -eq 'B' })).Count
    $totalCount = $srcUtcColumns.Count

    if ($dstRows.ContainsKey(7)) {
        $summaryRow = $dstRows[7]
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "A" ([string]$passedCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "C" ([string]$failedCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "F" ([string]$untestedCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "L" ([string]$nCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "M" ([string]$aCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "N" ([string]$bCount) ""
        Set-CellText $dstSheetXml $summaryRow $dstSheetNs "O" ([string]$totalCount) ""
    }

    $dstSheetXml.Save((Join-Path $dstDir ("xl\" + $dstSheetRel.GetAttribute("Target").Replace('/','\'))))
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
if (Test-Path -LiteralPath $TargetPath) { Remove-Item -LiteralPath $TargetPath -Force }

[System.IO.Compression.ZipFile]::CreateFromDirectory($dstDir,$zipPath)
Move-Item -LiteralPath $zipPath -Destination $TargetPath -Force

Remove-Item -LiteralPath $workDir -Recurse -Force

Write-Output "Synced footer: $TargetPath"
