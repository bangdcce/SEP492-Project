param(
    [string]$TemplatePath = "C:\Users\ASUS\Downloads\Unit Testing Excel (1)\Unit Testing Excel\Report5_Unit Test Case_v1.2.xlsx",
    [string]$CombinedSourcePath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.2_combined.xlsx"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-XmlFile {
    param([string]$Path)
    return [xml][System.IO.File]::ReadAllText($Path)
}

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

function Ensure-Override {
    param(
        [xml]$ContentTypesXml,
        [string]$PartName,
        [string]$ContentType
    )

    $existing = $ContentTypesXml.Types.Override | Where-Object { $_.PartName -eq $PartName } | Select-Object -First 1
    if (-not $existing) {
        $node = $ContentTypesXml.CreateElement("Override", $ContentTypesXml.DocumentElement.NamespaceURI)
        $node.SetAttribute("PartName", $PartName)
        $node.SetAttribute("ContentType", $ContentType)
        [void]$ContentTypesXml.Types.AppendChild($node)
    }
}

function Ensure-Default {
    param(
        [xml]$ContentTypesXml,
        [string]$Extension,
        [string]$ContentType
    )

    $existing = $ContentTypesXml.Types.Default | Where-Object { $_.Extension -eq $Extension } | Select-Object -First 1
    if (-not $existing) {
        $node = $ContentTypesXml.CreateElement("Default", $ContentTypesXml.DocumentElement.NamespaceURI)
        $node.SetAttribute("Extension", $Extension)
        $node.SetAttribute("ContentType", $ContentType)
        [void]$ContentTypesXml.Types.PrependChild($node)
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

function Update-CountAttribute {
    param(
        [System.Xml.XmlElement]$Element,
        [string]$XPath,
        [int]$Count,
        [System.Xml.XmlNamespaceManager]$NamespaceManager
    )

    $target = $Element.SelectSingleNode($XPath, $NamespaceManager)
    if ($target) {
        $target.SetAttribute("count", [string]$Count)
    }
}

$tempRoot = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets"
$workDir = Join-Path $tempRoot ("template-merge-" + [guid]::NewGuid().ToString())
$templateCopyPath = Join-Path $workDir "template-copy.xlsx"
$combinedCopyPath = Join-Path $workDir "combined-copy.xlsx"
$baseDir = Join-Path $workDir "base"
$templateDir = Join-Path $workDir "template"
$zipPath = Join-Path $workDir "out.zip"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Copy-FileSharedRead -SourcePath $TemplatePath -DestinationPath $templateCopyPath
Copy-Item -LiteralPath $CombinedSourcePath -Destination $combinedCopyPath -Force

[System.IO.Compression.ZipFile]::ExtractToDirectory($combinedCopyPath, $baseDir)
[System.IO.Compression.ZipFile]::ExtractToDirectory($templateCopyPath, $templateDir)

Copy-Item -LiteralPath (Join-Path $templateDir "xl\theme\theme1.xml") -Destination (Join-Path $baseDir "xl\theme\theme1.xml") -Force

$workbookPath = Join-Path $baseDir "xl\workbook.xml"
$workbookRelsPath = Join-Path $baseDir "xl\_rels\workbook.xml.rels"
$stylesPath = Join-Path $baseDir "xl\styles.xml"
$sharedStringsPath = Join-Path $baseDir "xl\sharedStrings.xml"
$contentTypesPath = Join-Path $baseDir "[Content_Types].xml"

$templateWorkbookPath = Join-Path $templateDir "xl\workbook.xml"
$templateWorkbookRelsPath = Join-Path $templateDir "xl\_rels\workbook.xml.rels"
$templateStylesPath = Join-Path $templateDir "xl\styles.xml"
$templateSharedStringsPath = Join-Path $templateDir "xl\sharedStrings.xml"

[xml]$workbookXml = Read-XmlFile $workbookPath
[xml]$workbookRelsXml = Read-XmlFile $workbookRelsPath
[xml]$stylesXml = Read-XmlFile $stylesPath
[xml]$sharedXml = Read-XmlFile $sharedStringsPath
[xml]$contentTypesXml = Read-XmlFile $contentTypesPath

[xml]$templateWorkbookXml = Read-XmlFile $templateWorkbookPath
[xml]$templateWorkbookRelsXml = Read-XmlFile $templateWorkbookRelsPath
[xml]$templateStylesXml = Read-XmlFile $templateStylesPath
[xml]$templateSharedXml = Read-XmlFile $templateSharedStringsPath

$stylesNs = New-Object System.Xml.XmlNamespaceManager($stylesXml.NameTable)
$stylesNs.AddNamespace("x", $stylesXml.DocumentElement.NamespaceURI)
$templateStylesNs = New-Object System.Xml.XmlNamespaceManager($templateStylesXml.NameTable)
$templateStylesNs.AddNamespace("x", $templateStylesXml.DocumentElement.NamespaceURI)
$wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
$wbNs.AddNamespace("x", $workbookXml.DocumentElement.NamespaceURI)
$wbRelNs = New-Object System.Xml.XmlNamespaceManager($workbookRelsXml.NameTable)
$wbRelNs.AddNamespace("x", $workbookRelsXml.DocumentElement.NamespaceURI)
$templateWbNs = New-Object System.Xml.XmlNamespaceManager($templateWorkbookXml.NameTable)
$templateWbNs.AddNamespace("x", $templateWorkbookXml.DocumentElement.NamespaceURI)
$templateRelNs = New-Object System.Xml.XmlNamespaceManager($templateWorkbookRelsXml.NameTable)
$templateRelNs.AddNamespace("x", $templateWorkbookRelsXml.DocumentElement.NamespaceURI)

$baseSharedValues = New-Object 'System.Collections.Generic.List[string]'
$baseSharedIndex = @{}
for ($i = 0; $i -lt $sharedXml.sst.si.Count; $i++) {
    $text = Get-SharedStringText $sharedXml.sst.si[$i]
    $baseSharedValues.Add($text)
    if (-not $baseSharedIndex.ContainsKey($text)) {
        $baseSharedIndex[$text] = $i
    }
}

$templateSharedValues = New-Object 'System.Collections.Generic.List[string]'
for ($i = 0; $i -lt $templateSharedXml.sst.si.Count; $i++) {
    $templateSharedValues.Add((Get-SharedStringText $templateSharedXml.sst.si[$i]))
}

$baseFontsNode = $stylesXml.SelectSingleNode("//x:fonts", $stylesNs)
$baseFillsNode = $stylesXml.SelectSingleNode("//x:fills", $stylesNs)
$baseBordersNode = $stylesXml.SelectSingleNode("//x:borders", $stylesNs)
$baseCellStyleXfsNode = $stylesXml.SelectSingleNode("//x:cellStyleXfs", $stylesNs)
$baseCellXfsNode = $stylesXml.SelectSingleNode("//x:cellXfs", $stylesNs)
$baseCellStylesNode = $stylesXml.SelectSingleNode("//x:cellStyles", $stylesNs)
$baseNumFmtsNode = $stylesXml.SelectSingleNode("//x:numFmts", $stylesNs)

$templateFontsNode = $templateStylesXml.SelectSingleNode("//x:fonts", $templateStylesNs)
$templateFillsNode = $templateStylesXml.SelectSingleNode("//x:fills", $templateStylesNs)
$templateBordersNode = $templateStylesXml.SelectSingleNode("//x:borders", $templateStylesNs)
$templateCellStyleXfsNode = $templateStylesXml.SelectSingleNode("//x:cellStyleXfs", $templateStylesNs)
$templateCellXfsNode = $templateStylesXml.SelectSingleNode("//x:cellXfs", $templateStylesNs)
$templateCellStylesNode = $templateStylesXml.SelectSingleNode("//x:cellStyles", $templateStylesNs)
$templateNumFmtsNode = $templateStylesXml.SelectSingleNode("//x:numFmts", $templateStylesNs)

if (-not $baseNumFmtsNode) {
    $baseNumFmtsNode = $stylesXml.CreateElement("numFmts", $stylesXml.DocumentElement.NamespaceURI)
    [void]$stylesXml.styleSheet.InsertBefore($baseNumFmtsNode, $baseFontsNode)
}

$baseFontOffset = $baseFontsNode.font.Count
$baseFillOffset = $baseFillsNode.fill.Count
$baseBorderOffset = $baseBordersNode.border.Count
$baseCellStyleXfOffset = $baseCellStyleXfsNode.xf.Count
$baseCellXfOffset = $baseCellXfsNode.xf.Count
$baseCellStyleCount = if ($baseCellStylesNode) { $baseCellStylesNode.cellStyle.Count } else { 0 }

$numFmtMap = @{}
$maxNumFmtId = 163
foreach ($node in @($baseNumFmtsNode.numFmt)) {
    $value = [int]$node.numFmtId
    if ($value -gt $maxNumFmtId) {
        $maxNumFmtId = $value
    }
}

foreach ($node in @($templateNumFmtsNode.numFmt)) {
    $oldId = [int]$node.numFmtId
    if ($oldId -lt 164) {
        $numFmtMap[$oldId] = $oldId
        continue
    }
    $maxNumFmtId++
    $numFmtMap[$oldId] = $maxNumFmtId
    $clone = $stylesXml.ImportNode($node, $true)
    $clone.SetAttribute("numFmtId", [string]$maxNumFmtId)
    [void]$baseNumFmtsNode.AppendChild($clone)
}

foreach ($font in @($templateFontsNode.font)) {
    [void]$baseFontsNode.AppendChild($stylesXml.ImportNode($font, $true))
}

foreach ($fill in @($templateFillsNode.fill)) {
    [void]$baseFillsNode.AppendChild($stylesXml.ImportNode($fill, $true))
}

foreach ($border in @($templateBordersNode.border)) {
    [void]$baseBordersNode.AppendChild($stylesXml.ImportNode($border, $true))
}

foreach ($xf in @($templateCellStyleXfsNode.xf)) {
    $clone = $stylesXml.ImportNode($xf, $true)
    if ($clone.HasAttribute("fontId")) { $clone.SetAttribute("fontId", [string]([int]$clone.fontId + $baseFontOffset)) }
    if ($clone.HasAttribute("fillId")) { $clone.SetAttribute("fillId", [string]([int]$clone.fillId + $baseFillOffset)) }
    if ($clone.HasAttribute("borderId")) { $clone.SetAttribute("borderId", [string]([int]$clone.borderId + $baseBorderOffset)) }
    if ($clone.HasAttribute("numFmtId")) {
        $old = [int]$clone.numFmtId
        if ($numFmtMap.ContainsKey($old)) {
            $clone.SetAttribute("numFmtId", [string]$numFmtMap[$old])
        }
    }
    [void]$baseCellStyleXfsNode.AppendChild($clone)
}

foreach ($xf in @($templateCellXfsNode.xf)) {
    $clone = $stylesXml.ImportNode($xf, $true)
    if ($clone.HasAttribute("fontId")) { $clone.SetAttribute("fontId", [string]([int]$clone.fontId + $baseFontOffset)) }
    if ($clone.HasAttribute("fillId")) { $clone.SetAttribute("fillId", [string]([int]$clone.fillId + $baseFillOffset)) }
    if ($clone.HasAttribute("borderId")) { $clone.SetAttribute("borderId", [string]([int]$clone.borderId + $baseBorderOffset)) }
    if ($clone.HasAttribute("numFmtId")) {
        $old = [int]$clone.numFmtId
        if ($numFmtMap.ContainsKey($old)) {
            $clone.SetAttribute("numFmtId", [string]$numFmtMap[$old])
        }
    }
    if ($clone.HasAttribute("xfId")) {
        $clone.SetAttribute("xfId", [string]([int]$clone.xfId + $baseCellStyleXfOffset))
    }
    [void]$baseCellXfsNode.AppendChild($clone)
}

if ($baseCellStylesNode -and $templateCellStylesNode) {
    foreach ($cellStyle in @($templateCellStylesNode.cellStyle)) {
        $clone = $stylesXml.ImportNode($cellStyle, $true)
        if ($clone.HasAttribute("xfId")) {
            $clone.SetAttribute("xfId", [string]([int]$clone.xfId + $baseCellStyleXfOffset))
        }
        [void]$baseCellStylesNode.AppendChild($clone)
    }
    $baseCellStylesNode.SetAttribute("count", [string]$baseCellStylesNode.cellStyle.Count)
}

$baseNumFmtsNode.SetAttribute("count", [string]$baseNumFmtsNode.numFmt.Count)
$baseFontsNode.SetAttribute("count", [string]$baseFontsNode.font.Count)
$baseFillsNode.SetAttribute("count", [string]$baseFillsNode.fill.Count)
$baseBordersNode.SetAttribute("count", [string]$baseBordersNode.border.Count)
$baseCellStyleXfsNode.SetAttribute("count", [string]$baseCellStyleXfsNode.xf.Count)
$baseCellXfsNode.SetAttribute("count", [string]$baseCellXfsNode.xf.Count)

$sheetsNode = $workbookXml.SelectSingleNode("//x:sheets", $wbNs)
$firstExistingSheet = $workbookXml.SelectSingleNode("//x:sheets/x:sheet[1]", $wbNs)
$relationshipsRoot = $workbookRelsXml.DocumentElement
$templateSheetPrototype = $firstExistingSheet
$templateRelationshipPrototype = $workbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[contains(@Type,'/worksheet')][1]", $wbRelNs)

$sheetNames = @("Guideline", "Cover", "Function List", "Test Report")
$sheetNumberMap = @{
    "Guideline" = 20
    "Cover" = 21
    "Function List" = 22
    "Test Report" = 23
}
$sheetRelIdMap = @{
    "Guideline" = "rId24"
    "Cover" = "rId25"
    "Function List" = "rId26"
    "Test Report" = "rId27"
}

$sheetFileMap = @{
    "Guideline" = "sheet20.xml"
    "Cover" = "sheet21.xml"
    "Function List" = "sheet22.xml"
    "Test Report" = "sheet23.xml"
}

$drawingTargetMap = @{
    "../drawings/drawing1.xml" = "../drawings/drawing12.xml"
    "../drawings/drawing2.xml" = "../drawings/drawing13.xml"
}

foreach ($sheetName in $sheetNames) {
    $sourceSheetNode = $templateWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='$sheetName']", $templateWbNs)
    $sourceSheetRelId = $sourceSheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $sourceSheetRel = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$sourceSheetRelId']", $templateRelNs)
    $sourceSheetTarget = $sourceSheetRel.GetAttribute("Target").Replace('/', '\')
    $sourceSheetPath = Join-Path $templateDir ("xl\" + $sourceSheetTarget)
    [xml]$sourceSheetXml = Read-XmlFile $sourceSheetPath
    $sourceSheetNs = New-Object System.Xml.XmlNamespaceManager($sourceSheetXml.NameTable)
    $sourceSheetNs.AddNamespace("x", $sourceSheetXml.DocumentElement.NamespaceURI)

    foreach ($valueNode in $sourceSheetXml.SelectNodes("//x:c[@t='s']/x:v", $sourceSheetNs)) {
        $oldIndex = [int]$valueNode.InnerText
        $text = $templateSharedValues[$oldIndex]
        $newIndex = Add-SharedString -SharedXml $sharedXml -SharedIndex $baseSharedIndex -SharedValues $baseSharedValues -Text $text
        $valueNode.InnerText = [string]$newIndex
    }

    foreach ($cell in $sourceSheetXml.SelectNodes("//x:c[@s]", $sourceSheetNs)) {
        $cell.SetAttribute("s", [string]([int]$cell.GetAttribute("s") + $baseCellXfOffset))
    }
    foreach ($row in $sourceSheetXml.SelectNodes("//x:row[@s]", $sourceSheetNs)) {
        $row.SetAttribute("s", [string]([int]$row.GetAttribute("s") + $baseCellXfOffset))
    }
    foreach ($col in $sourceSheetXml.SelectNodes("//x:cols/x:col[@style]", $sourceSheetNs)) {
        $col.SetAttribute("style", [string]([int]$col.GetAttribute("style") + $baseCellXfOffset))
    }

    $targetSheetFile = $sheetFileMap[$sheetName]
    $targetSheetPath = Join-Path $baseDir ("xl\worksheets\" + $targetSheetFile)
    $sourceSheetXml.Save($targetSheetPath)
    Ensure-Override -ContentTypesXml $contentTypesXml -PartName ("/xl/worksheets/" + $targetSheetFile) -ContentType "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"

    $sourceSheetRelsPath = Join-Path $templateDir ("xl\worksheets\_rels\" + [System.IO.Path]::GetFileName($sourceSheetTarget) + ".rels")
    $targetSheetRelsDir = Join-Path $baseDir "xl\worksheets\_rels"
    New-Item -ItemType Directory -Force -Path $targetSheetRelsDir | Out-Null
    $targetSheetRelsPath = Join-Path $targetSheetRelsDir ($targetSheetFile + ".rels")

    if (Test-Path -LiteralPath $sourceSheetRelsPath) {
        [xml]$sheetRelsXml = Read-XmlFile $sourceSheetRelsPath
        $sheetRelsNs = New-Object System.Xml.XmlNamespaceManager($sheetRelsXml.NameTable)
        $sheetRelsNs.AddNamespace("x", $sheetRelsXml.DocumentElement.NamespaceURI)

        foreach ($relationship in $sheetRelsXml.SelectNodes("/x:Relationships/x:Relationship", $sheetRelsNs)) {
            $target = $relationship.GetAttribute("Target")
            if ($drawingTargetMap.ContainsKey($target)) {
                $relationship.SetAttribute("Target", $drawingTargetMap[$target])
            }
        }

        $sheetRelsXml.Save($targetSheetRelsPath)
    }

    $newRelationship = $workbookRelsXml.ImportNode($templateRelationshipPrototype, $true)
    $newRelationship.SetAttribute("Id", $sheetRelIdMap[$sheetName])
    $newRelationship.SetAttribute("Target", "worksheets/" + $targetSheetFile)
    [void]$relationshipsRoot.AppendChild($newRelationship)

    $newSheetNode = $workbookXml.ImportNode($templateSheetPrototype, $true)
    $newSheetNode.SetAttribute("name", $sheetName)
    $newSheetNode.SetAttribute("sheetId", [string]$sheetNumberMap[$sheetName])
    $newSheetNode.SetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships", $sheetRelIdMap[$sheetName])
    if ($newSheetNode.HasAttribute("state")) {
        $newSheetNode.RemoveAttribute("state")
    }
    [void]$sheetsNode.InsertBefore($newSheetNode, $firstExistingSheet)
}

New-Item -ItemType Directory -Force -Path (Join-Path $baseDir "xl\drawings\_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $baseDir "xl\media") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $baseDir "xl\charts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $baseDir "xl\printerSettings") | Out-Null

Copy-Item -LiteralPath (Join-Path $templateDir "xl\comments1.xml") -Destination (Join-Path $baseDir "xl\comments1.xml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\drawings\vmlDrawing1.vml") -Destination (Join-Path $baseDir "xl\drawings\vmlDrawing1.vml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\printerSettings\printerSettings1.bin") -Destination (Join-Path $baseDir "xl\printerSettings\printerSettings1.bin") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\charts\chart1.xml") -Destination (Join-Path $baseDir "xl\charts\chart1.xml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\charts\chart2.xml") -Destination (Join-Path $baseDir "xl\charts\chart2.xml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\drawings\drawing1.xml") -Destination (Join-Path $baseDir "xl\drawings\drawing12.xml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\drawings\drawing2.xml") -Destination (Join-Path $baseDir "xl\drawings\drawing13.xml") -Force
Copy-Item -LiteralPath (Join-Path $templateDir "xl\media\image1.png") -Destination (Join-Path $baseDir "xl\media\image4.png") -Force

[xml]$drawing12RelsXml = Read-XmlFile (Join-Path $templateDir "xl\drawings\_rels\drawing1.xml.rels")
$drawing12Ns = New-Object System.Xml.XmlNamespaceManager($drawing12RelsXml.NameTable)
$drawing12Ns.AddNamespace("x", $drawing12RelsXml.DocumentElement.NamespaceURI)
foreach ($relationship in $drawing12RelsXml.SelectNodes("/x:Relationships/x:Relationship", $drawing12Ns)) {
    if ($relationship.GetAttribute("Target") -eq "../media/image1.png") {
        $relationship.SetAttribute("Target", "../media/image4.png")
    }
}
$drawing12RelsXml.Save((Join-Path $baseDir "xl\drawings\_rels\drawing12.xml.rels"))

Copy-Item -LiteralPath (Join-Path $templateDir "xl\drawings\_rels\drawing2.xml.rels") -Destination (Join-Path $baseDir "xl\drawings\_rels\drawing13.xml.rels") -Force

Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/comments1.xml" -ContentType "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"
Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/printerSettings/printerSettings1.bin" -ContentType "application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"
Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/drawings/drawing12.xml" -ContentType "application/vnd.openxmlformats-officedocument.drawing+xml"
Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/drawings/drawing13.xml" -ContentType "application/vnd.openxmlformats-officedocument.drawing+xml"
Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/charts/chart1.xml" -ContentType "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
Ensure-Override -ContentTypesXml $contentTypesXml -PartName "/xl/charts/chart2.xml" -ContentType "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
Ensure-Default -ContentTypesXml $contentTypesXml -Extension "vml" -ContentType "application/vnd.openxmlformats-officedocument.vmlDrawing"

$workbookView = $workbookXml.SelectSingleNode("//x:bookViews/x:workbookView", $wbNs)
if ($workbookView) {
    $workbookView.SetAttribute("activeTab", "0")
    $workbookView.SetAttribute("firstSheet", "0")
}

$sharedXml.sst.SetAttribute("count", [string]$sharedXml.sst.si.Count)
$sharedXml.sst.SetAttribute("uniqueCount", [string]$sharedXml.sst.si.Count)

$stylesXml.Save($stylesPath)
$sharedXml.Save($sharedStringsPath)
$workbookXml.Save($workbookPath)
$workbookRelsXml.Save($workbookRelsPath)
$contentTypesXml.Save($contentTypesPath)

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
if (Test-Path -LiteralPath $OutputWorkbookPath) {
    Remove-Item -LiteralPath $OutputWorkbookPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($baseDir, $zipPath)
Move-Item -LiteralPath $zipPath -Destination $OutputWorkbookPath -Force

Remove-Item -LiteralPath $workDir -Recurse -Force

Write-Output "Generated workbook: $OutputWorkbookPath"
