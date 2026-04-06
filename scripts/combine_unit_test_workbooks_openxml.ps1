param(
    [string]$SourceDir = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\docs\unit",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

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

function Get-SharedStringText {
    param([System.Xml.XmlElement]$Si)

    if ($Si.t) {
        return [string]$Si.t
    }

    if ($Si.r) {
        $text = ""
        foreach ($run in $Si.r) {
            if ($run.t -is [string]) {
                $text += $run.t
            }
            elseif ($run.t.'#text') {
                $text += $run.t.'#text'
            }
        }
        return $text
    }

    return ""
}

function Add-SharedString {
    param(
        [xml]$SharedXml,
        [hashtable]$SharedIndex,
        [System.Collections.Generic.List[string]]$SharedValues,
        [string]$Text
    )

    if ($SharedIndex.ContainsKey($Text)) {
        return $SharedIndex[$Text]
    }

    $si = $SharedXml.CreateElement("si", $SharedXml.DocumentElement.NamespaceURI)
    $t = $SharedXml.CreateElement("t", $SharedXml.DocumentElement.NamespaceURI)
    if ($Text.StartsWith(" ") -or $Text.EndsWith(" ") -or $Text.Contains("`n")) {
        $spaceAttr = $SharedXml.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
        $spaceAttr.Value = "preserve"
        [void]$t.Attributes.Append($spaceAttr)
    }
    $t.InnerText = $Text
    [void]$si.AppendChild($t)
    [void]$SharedXml.sst.AppendChild($si)

    $index = $SharedValues.Count
    $SharedValues.Add($Text)
    $SharedIndex[$Text] = $index

    return $index
}

function Ensure-WorksheetOverride {
    param(
        [xml]$ContentTypesXml,
        [int]$SheetNumber
    )

    $partName = "/xl/worksheets/sheet$SheetNumber.xml"
    $override = $ContentTypesXml.Types.Override | Where-Object { $_.PartName -eq $partName } | Select-Object -First 1
    if (-not $override) {
        $node = $ContentTypesXml.CreateElement("Override", $ContentTypesXml.DocumentElement.NamespaceURI)
        $node.SetAttribute("PartName", $partName)
        $node.SetAttribute(
            "ContentType",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
        )
        [void]$ContentTypesXml.Types.AppendChild($node)
    }
}

$sourcePaths = foreach ($fileName in $orderedFiles) {
    $fullPath = Join-Path $SourceDir $fileName
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing source workbook: $fullPath"
    }
    $fullPath
}

$outputDir = Split-Path -Parent $OutputWorkbookPath
$tempRoot = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets"
$workDir = Join-Path $tempRoot ("merge-" + [guid]::NewGuid().ToString())
$baseExtractDir = Join-Path $workDir "base"
$tempZip = Join-Path $workDir ([System.IO.Path]::GetFileName($OutputWorkbookPath).Replace('.xlsx', '.zip'))

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

[System.IO.Compression.ZipFile]::ExtractToDirectory($sourcePaths[0], $baseExtractDir)

$workbookPath = Join-Path $baseExtractDir "xl\workbook.xml"
$workbookRelsPath = Join-Path $baseExtractDir "xl\_rels\workbook.xml.rels"
$sharedStringsPath = Join-Path $baseExtractDir "xl\sharedStrings.xml"
$contentTypesPath = Join-Path $baseExtractDir "[Content_Types].xml"

[xml]$workbookXml = [System.IO.File]::ReadAllText($workbookPath)
[xml]$workbookRelsXml = [System.IO.File]::ReadAllText($workbookRelsPath)
[xml]$sharedXml = [System.IO.File]::ReadAllText($sharedStringsPath)
[xml]$contentTypesXml = [System.IO.File]::ReadAllText($contentTypesPath)

$wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
$wbNs.AddNamespace("x", $workbookXml.DocumentElement.NamespaceURI)
$relsNs = New-Object System.Xml.XmlNamespaceManager($workbookRelsXml.NameTable)
$relsNs.AddNamespace("x", $workbookRelsXml.DocumentElement.NamespaceURI)

$sharedValues = New-Object 'System.Collections.Generic.List[string]'
$sharedIndex = @{}
for ($i = 0; $i -lt $sharedXml.sst.si.Count; $i++) {
    $text = Get-SharedStringText $sharedXml.sst.si[$i]
    $sharedValues.Add($text)
    if (-not $sharedIndex.ContainsKey($text)) {
        $sharedIndex[$text] = $i
    }
}

$sheetsNode = $workbookXml.SelectSingleNode("//x:sheets", $wbNs)
$templateSheetNode = $workbookXml.SelectSingleNode("//x:sheets/x:sheet", $wbNs)
foreach ($sheetNode in @($workbookXml.SelectNodes("//x:sheets/x:sheet", $wbNs))) {
    [void]$sheetsNode.RemoveChild($sheetNode)
}

$relationshipsRoot = $workbookRelsXml.DocumentElement
$templateWorksheetRel = $workbookRelsXml.SelectSingleNode(
    "/x:Relationships/x:Relationship[contains(@Type,'/worksheet')]",
    $relsNs
)
foreach ($relNode in @($workbookRelsXml.SelectNodes("/x:Relationships/x:Relationship[contains(@Type,'/worksheet')]", $relsNs))) {
    [void]$relationshipsRoot.RemoveChild($relNode)
}

for ($index = 0; $index -lt $sourcePaths.Count; $index++) {
    $sheetNumber = $index + 1
    $relationshipId = "rId" + (4 + $sheetNumber)
    $sourcePath = $sourcePaths[$index]
    $sourceExtractDir = Join-Path $workDir ("src-" + $sheetNumber)
    [System.IO.Compression.ZipFile]::ExtractToDirectory($sourcePath, $sourceExtractDir)

    try {
        $sourceWorkbookPath = Join-Path $sourceExtractDir "xl\workbook.xml"
        $sourceWorkbookRelsPath = Join-Path $sourceExtractDir "xl\_rels\workbook.xml.rels"
        $sourceSharedStringsPath = Join-Path $sourceExtractDir "xl\sharedStrings.xml"

        [xml]$sourceWorkbookXml = [System.IO.File]::ReadAllText($sourceWorkbookPath)
        [xml]$sourceWorkbookRelsXml = [System.IO.File]::ReadAllText($sourceWorkbookRelsPath)
        [xml]$sourceSharedXml = [System.IO.File]::ReadAllText($sourceSharedStringsPath)

        $sourceWbNs = New-Object System.Xml.XmlNamespaceManager($sourceWorkbookXml.NameTable)
        $sourceWbNs.AddNamespace("x", $sourceWorkbookXml.DocumentElement.NamespaceURI)
        $sourceRelNs = New-Object System.Xml.XmlNamespaceManager($sourceWorkbookRelsXml.NameTable)
        $sourceRelNs.AddNamespace("x", $sourceWorkbookRelsXml.DocumentElement.NamespaceURI)

        $sourceSheetNode = $sourceWorkbookXml.SelectSingleNode("//x:sheets/x:sheet", $sourceWbNs)
        $sourceSheetName = $sourceSheetNode.GetAttribute("name")
        $sourceSheetRelId = $sourceSheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
        $sourceWorksheetRel = $sourceWorkbookRelsXml.SelectSingleNode(
            "/x:Relationships/x:Relationship[@Id='$sourceSheetRelId']",
            $sourceRelNs
        )
        $sourceSheetTarget = $sourceWorksheetRel.GetAttribute("Target").Replace('/', '\')
        $sourceSheetFileName = [System.IO.Path]::GetFileName($sourceSheetTarget)
        $sourceSheetPath = Join-Path $sourceExtractDir ("xl\" + $sourceSheetTarget)
        $sourceSheetRelsPath = Join-Path $sourceExtractDir ("xl\worksheets\_rels\" + $sourceSheetFileName + ".rels")

        [xml]$sourceSheetXml = [System.IO.File]::ReadAllText($sourceSheetPath)
        $sourceSheetNs = New-Object System.Xml.XmlNamespaceManager($sourceSheetXml.NameTable)
        $sourceSheetNs.AddNamespace("x", $sourceSheetXml.DocumentElement.NamespaceURI)

        $sourceSharedValues = New-Object 'System.Collections.Generic.List[string]'
        for ($i = 0; $i -lt $sourceSharedXml.sst.si.Count; $i++) {
            $sourceSharedValues.Add((Get-SharedStringText $sourceSharedXml.sst.si[$i]))
        }

        foreach ($cell in $sourceSheetXml.SelectNodes("//x:c[@t='s']/x:v", $sourceSheetNs)) {
            $sourceIndex = [int]$cell.InnerText
            $text = $sourceSharedValues[$sourceIndex]
            $targetIndex = Add-SharedString -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -Text $text
            $cell.InnerText = [string]$targetIndex
        }

        $targetSheetPath = Join-Path $baseExtractDir ("xl\worksheets\sheet$sheetNumber.xml")
        $sourceSheetXml.Save($targetSheetPath)

        $targetSheetRelsDir = Join-Path $baseExtractDir "xl\worksheets\_rels"
        New-Item -ItemType Directory -Force -Path $targetSheetRelsDir | Out-Null
        $targetSheetRelsPath = Join-Path $targetSheetRelsDir ("sheet$sheetNumber.xml.rels")
        if (Test-Path -LiteralPath $sourceSheetRelsPath) {
            Copy-Item -LiteralPath $sourceSheetRelsPath -Destination $targetSheetRelsPath -Force
        }
        elseif (Test-Path -LiteralPath $targetSheetRelsPath) {
            Remove-Item -LiteralPath $targetSheetRelsPath -Force
        }

        Ensure-WorksheetOverride -ContentTypesXml $contentTypesXml -SheetNumber $sheetNumber

        $newRelNode = $workbookRelsXml.ImportNode($templateWorksheetRel, $true)
        $newRelNode.SetAttribute("Id", $relationshipId)
        $newRelNode.SetAttribute("Target", "worksheets/sheet$sheetNumber.xml")
        [void]$relationshipsRoot.AppendChild($newRelNode)

        $newSheetNode = $workbookXml.ImportNode($templateSheetNode, $true)
        $newSheetNode.SetAttribute("name", $sourceSheetName)
        $newSheetNode.SetAttribute("sheetId", [string]$sheetNumber)
        $newSheetNode.SetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships", $relationshipId)
        if ($newSheetNode.HasAttribute("state")) {
            $newSheetNode.RemoveAttribute("state")
        }
        [void]$sheetsNode.AppendChild($newSheetNode)
    }
    finally {
        if (Test-Path -LiteralPath $sourceExtractDir) {
            Remove-Item -LiteralPath $sourceExtractDir -Recurse -Force
        }
    }
}

$workbookView = $workbookXml.SelectSingleNode("//x:bookViews/x:workbookView", $wbNs)
if ($workbookView) {
    $workbookView.SetAttribute("activeTab", "0")
    $workbookView.SetAttribute("firstSheet", "0")
}

$sharedXml.sst.SetAttribute("count", [string]$sharedXml.sst.si.Count)
$sharedXml.sst.SetAttribute("uniqueCount", [string]$sharedXml.sst.si.Count)

$workbookXml.Save($workbookPath)
$workbookRelsXml.Save($workbookRelsPath)
$sharedXml.Save($sharedStringsPath)
$contentTypesXml.Save($contentTypesPath)

if (Test-Path -LiteralPath $tempZip) {
    Remove-Item -LiteralPath $tempZip -Force
}
if (Test-Path -LiteralPath $OutputWorkbookPath) {
    Remove-Item -LiteralPath $OutputWorkbookPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($baseExtractDir, $tempZip)
Move-Item -LiteralPath $tempZip -Destination $OutputWorkbookPath -Force
Remove-Item -LiteralPath $workDir -Recurse -Force

Write-Output "Generated workbook: $OutputWorkbookPath"
