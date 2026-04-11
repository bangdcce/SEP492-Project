param(
    [string]$SourceWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\Unit Test (1).xlsx",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\docs\unit\post-auth-register-unit-test.xlsx"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

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
            } elseif ($run.t.'#text') {
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

function Get-OrCreate-BoldFontId {
    param(
        [xml]$StylesXml,
        [int]$BaseFontId
    )

    if (-not $script:BoldFontMap) {
        $script:BoldFontMap = @{}
    }

    if ($script:BoldFontMap.ContainsKey($BaseFontId)) {
        return $script:BoldFontMap[$BaseFontId]
    }

    $fontsNode = $StylesXml.styleSheet.fonts
    $fonts = @($fontsNode.SelectNodes("*[local-name()='font']"))
    $baseFont = $fonts[$BaseFontId]
    $newFont = $StylesXml.ImportNode($baseFont, $true)

    if (-not $newFont.b) {
        $boldNode = $StylesXml.CreateElement("b", $StylesXml.DocumentElement.NamespaceURI)
        if ($newFont.FirstChild) {
            [void]$newFont.InsertBefore($boldNode, $newFont.FirstChild)
        } else {
            [void]$newFont.AppendChild($boldNode)
        }
    }

    [void]$fontsNode.AppendChild($newFont)

    $fontCount = @($fontsNode.SelectNodes("*[local-name()='font']")).Count
    $newFontId = $fontCount - 1
    $fontsNode.SetAttribute("count", [string]$fontCount)
    $script:BoldFontMap[$BaseFontId] = $newFontId

    return $newFontId
}

function Get-OrCreate-BoldStyleId {
    param(
        [xml]$StylesXml,
        [int]$BaseStyleId
    )

    if (-not $script:BoldStyleMap) {
        $script:BoldStyleMap = @{}
    }

    if ($script:BoldStyleMap.ContainsKey($BaseStyleId)) {
        return $script:BoldStyleMap[$BaseStyleId]
    }

    $cellXfsNode = $StylesXml.styleSheet.cellXfs
    $xfs = @($cellXfsNode.SelectNodes("*[local-name()='xf']"))
    $baseXf = $xfs[$BaseStyleId]
    $baseFontId = [int]$baseXf.fontId
    $boldFontId = Get-OrCreate-BoldFontId -StylesXml $StylesXml -BaseFontId $baseFontId

    $newXf = $StylesXml.ImportNode($baseXf, $true)
    $newXf.SetAttribute("fontId", [string]$boldFontId)
    $newXf.SetAttribute("applyFont", "1")
    [void]$cellXfsNode.AppendChild($newXf)

    $xfCount = @($cellXfsNode.SelectNodes("*[local-name()='xf']")).Count
    $newStyleId = $xfCount - 1
    $cellXfsNode.SetAttribute("count", [string]$xfCount)
    $script:BoldStyleMap[$BaseStyleId] = $newStyleId

    return $newStyleId
}

function Get-OrCreate-StyleVariantId {
    param(
        [xml]$StylesXml,
        [int]$BaseStyleId,
        [bool]$MakeBold = $false,
        [string]$Horizontal = "",
        [string]$Vertical = "",
        [Nullable[bool]]$WrapText = $null
    )

    if (-not $script:StyleVariantMap) {
        $script:StyleVariantMap = @{}
    }

    $wrapKey = if ($null -eq $WrapText) { "null" } else { [string]$WrapText }
    $mapKey = "$BaseStyleId|$MakeBold|$Horizontal|$Vertical|$wrapKey"
    if ($script:StyleVariantMap.ContainsKey($mapKey)) {
        return $script:StyleVariantMap[$mapKey]
    }

    $cellXfsNode = $StylesXml.styleSheet.cellXfs
    $xfs = @($cellXfsNode.SelectNodes("*[local-name()='xf']"))
    $baseXf = $xfs[$BaseStyleId]
    $newXf = $StylesXml.ImportNode($baseXf, $true)

    if ($MakeBold) {
        $baseFontId = [int]$baseXf.fontId
        $boldFontId = Get-OrCreate-BoldFontId -StylesXml $StylesXml -BaseFontId $baseFontId
        $newXf.SetAttribute("fontId", [string]$boldFontId)
        $newXf.SetAttribute("applyFont", "1")
    }

    $alignmentNode = $newXf.SelectSingleNode("*[local-name()='alignment']")
    if (-not $alignmentNode) {
        $alignmentNode = $StylesXml.CreateElement("alignment", $StylesXml.DocumentElement.NamespaceURI)
        [void]$newXf.AppendChild($alignmentNode)
    }

    if ($Horizontal) {
        $alignmentNode.SetAttribute("horizontal", $Horizontal)
    } elseif ($alignmentNode.HasAttribute("horizontal")) {
        $alignmentNode.RemoveAttribute("horizontal")
    }

    if ($Vertical) {
        $alignmentNode.SetAttribute("vertical", $Vertical)
    } elseif ($alignmentNode.HasAttribute("vertical")) {
        $alignmentNode.RemoveAttribute("vertical")
    }

    if ($null -ne $WrapText) {
        $alignmentNode.SetAttribute("wrapText", $(if ($WrapText) { "1" } else { "0" }))
    } elseif ($alignmentNode.HasAttribute("wrapText")) {
        $alignmentNode.RemoveAttribute("wrapText")
    }

    $newXf.SetAttribute("applyAlignment", "1")
    [void]$cellXfsNode.AppendChild($newXf)

    $xfCount = @($cellXfsNode.SelectNodes("*[local-name()='xf']")).Count
    $newStyleId = $xfCount - 1
    $cellXfsNode.SetAttribute("count", [string]$xfCount)
    $script:StyleVariantMap[$mapKey] = $newStyleId

    return $newStyleId
}

function Ensure-FontIsNotBold {
    param(
        [xml]$StylesXml,
        [int]$FontId
    )

    $fonts = @($StylesXml.styleSheet.fonts.SelectNodes("*[local-name()='font']"))
    $font = $fonts[$FontId]
    foreach ($boldNode in @($font.SelectNodes("*[local-name()='b']"))) {
        [void]$font.RemoveChild($boldNode)
    }
}

function Set-StringCellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [xml]$SharedXml,
        [hashtable]$SharedIndex,
        [System.Collections.Generic.List[string]]$SharedValues,
        [string]$CellRef,
        [string]$Text
    )

    $cell = $SheetXml.SelectSingleNode("//x:c[@r='$CellRef']", $SheetNs)
    if (-not $cell) {
        throw "Expected cell $CellRef to exist in sheet4.xml"
    }

    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }

    $cell.SetAttribute("t", "s")
    $v = $SheetXml.CreateElement("v", $SheetXml.DocumentElement.NamespaceURI)
    $v.InnerText = [string](Add-SharedString -SharedXml $SharedXml -SharedIndex $SharedIndex -SharedValues $SharedValues -Text $Text)
    [void]$cell.AppendChild($v)
}

function Set-NumberCellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [string]$CellRef,
        [string]$Value
    )

    $cell = $SheetXml.SelectSingleNode("//x:c[@r='$CellRef']", $SheetNs)
    if (-not $cell) {
        throw "Expected cell $CellRef to exist in sheet4.xml"
    }

    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }

    if ($cell.HasAttribute("t")) {
        $cell.RemoveAttribute("t")
    }

    $v = $SheetXml.CreateElement("v", $SheetXml.DocumentElement.NamespaceURI)
    $v.InnerText = $Value
    [void]$cell.AppendChild($v)
}

function Clear-CellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [string]$CellRef
    )

    $cell = $SheetXml.SelectSingleNode("//x:c[@r='$CellRef']", $SheetNs)
    if (-not $cell) {
        return
    }

    if ($cell.HasAttribute("t")) {
        $cell.RemoveAttribute("t")
    }

    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }
}

$outputDir = Split-Path -Parent $OutputWorkbookPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$tempDir = Join-Path $outputDir ("tmp-register-unit-" + [guid]::NewGuid().ToString())
$tempZip = Join-Path $outputDir ("tmp-" + [System.IO.Path]::GetFileName($OutputWorkbookPath))

New-Item -ItemType Directory -Path $tempDir | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($SourceWorkbookPath, $tempDir)

$workbookPath = Join-Path $tempDir "xl\workbook.xml"
$sharedStringsPath = Join-Path $tempDir "xl\sharedStrings.xml"
$stylesPath = Join-Path $tempDir "xl\styles.xml"
$sheetPath = Join-Path $tempDir "xl\worksheets\sheet4.xml"

[xml]$workbookXml = Get-Content -Raw -Path $workbookPath
[xml]$sharedXml = Get-Content -Raw -Path $sharedStringsPath
[xml]$stylesXml = Get-Content -Raw -Path $stylesPath
[xml]$sheetXml = Get-Content -Raw -Path $sheetPath

$wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
$wbNs.AddNamespace("x", $workbookXml.DocumentElement.NamespaceURI)
$sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
$sheetNs.AddNamespace("x", $sheetXml.DocumentElement.NamespaceURI)

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
$allSheets = @($workbookXml.SelectNodes("//x:sheets/x:sheet", $wbNs))
$targetSheet = $allSheets | Where-Object { $_.GetAttribute("name") -eq "Register Account" } | Select-Object -First 1

if (-not $targetSheet) {
    throw "Register Account sheet not found in source workbook."
}

foreach ($sheet in $allSheets) {
    if ($sheet -ne $targetSheet) {
        [void]$sheetsNode.RemoveChild($sheet)
    }
}

$targetSheet.SetAttribute("sheetId", "1")
if ($targetSheet.HasAttribute("state")) {
    $targetSheet.RemoveAttribute("state")
}

$workbookView = $workbookXml.SelectSingleNode("//x:bookViews/x:workbookView", $wbNs)
if ($workbookView) {
    $workbookView.SetAttribute("activeTab", "0")
    $workbookView.SetAttribute("firstSheet", "0")
}

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C2" -Text "EP-009"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "K2" -Text "Register Account"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C3" -Text "Codex"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "K3" -Text "Codex"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C5" -Text "Cover POST /auth/register in one UTC sheet with executed Jest evidence."

$allCaseColumns = @("E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U")
$caseColumns = @("E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q")
$utcHeaders = @{
    E = "UTCID01"; F = "UTCID02"; G = "UTCID03"; H = "UTCID04"; I = "UTCID05"; J = "UTCID06"; K = "UTCID07";
    L = "UTCID08"; M = "UTCID09"; N = "UTCID10"; O = "UTCID11"; P = "UTCID12"; Q = "UTCID13"
}

foreach ($column in $allCaseColumns) {
    foreach ($row in 9..56) {
        Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "$column$row"
    }
}

foreach ($row in 10..53) {
    Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C$row"
}

foreach ($row in 10..54) {
    Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "B$row"
}
foreach ($row in 42..53) {
    Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "A$row"
}

foreach ($column in $caseColumns) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}9" -Text $utcHeaders[$column]
}

Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "A7" -Value "13"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C7" -Value "0"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "E7" -Value "0"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "K7" -Value "4"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "L7" -Value "9"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "M7" -Value "4"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "N7" -Value "13"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B10" -Text "Precondition"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C11" -Text "No existing user matches the submitted email"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C12" -Text "Verification email and audit logging are available"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C13" -Text "Duplicate email already exists"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C14" -Text "Verification email or audit log side-effect fails"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C15" -Text "Legal consent is accepted"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C16" -Text "Request omits the user-agent header"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B17" -Text "email"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C18" -Text '"baong.client01@gmail.com"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C19" -Text '"baong.freelancer01@gmail.com"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C20" -Text '"baong.broker01@gmail.com"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C21" -Text '"email.fail@gmail.com"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C22" -Text '"baong.gmail.com"'

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B23" -Text "password"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C24" -Text '"BaoNG@12345"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C25" -Text '"weakpass"'

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B26" -Text "fullName"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C27" -Text '"Nguyen Van A"'

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B28" -Text "phoneNumber"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C29" -Text '"0987654321"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C30" -Text '"12345"'

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B31" -Text "role"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C32" -Text "CLIENT"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C33" -Text "FREELANCER"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C34" -Text "BROKER"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B36" -Text "domainIds / skillIds"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C37" -Text "domainIds omitted, skillIds omitted"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C38" -Text "domainIds = [2, 5], skillIds = [11]"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C39" -Text "domainIds = [], skillIds = []"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "A42" -Text "Confirm"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B42" -Text "Return"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C43" -Text "Returns successful registration response"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C44" -Text "Returns AuthResponseDto"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C45" -Text "Returns client account data"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C46" -Text "Returns freelancer account data"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C47" -Text "Returns broker account data"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C48" -Text 'Returns "Unknown Device" when header is missing'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C49" -Text "Returns success response when side-effect fails"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B50" -Text "Exception"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C51" -Text "Returns ConflictException for duplicate email"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C52" -Text "Returns ConflictException for missing legal consent"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C53" -Text "Returns Validation/BadRequest for invalid input"

$types = @{
    E = "N"; F = "N"; G = "N"; H = "B"; I = "A"; J = "A"; K = "A"; L = "A"; M = "A"; N = "A";
    O = "A"; P = "A"; Q = "A"
}
foreach ($column in $caseColumns) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}54" -Text $types[$column]
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}55" -Text "P"
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}56" -Text "03-28"
}
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B54" -Text "Type(N : Normal, A : Abnormal, B : Boundary)"

$oCellsToMark = @(
    "E11","F11","G11","H11","I11","J11","K11","M11","N11","O11","P11","Q11",
    "E12","F12","G12","H12","J12","K12",
    "L13",
    "I14",
    "E15","F15","G15","H15","I15","J15","K15","L15","N15","O15","P15","Q15",
    "K16",
    "E18","J18","K18","M18","N18","O18","P18","Q18",
    "F19",
    "G20","H20","I20",
    "I21",
    "O22",
    "E24","F24","G24","H24","I24","J24","K24","L24","M24","N24","O24","Q24",
    "P25",
    "E27","F27","G27","H27","I27","J27","K27","L27","M27","N27","O27","P27","Q27",
    "E29","F29","G29","H29","I29","J29","K29","L29","M29","O29","P29","Q29",
    "N30",
    "E32","J32","K32","L32","M32","N32","O32","P32","Q32",
    "F33",
    "G34","H34","I34",
    "E37","J37","K37","L37","M37","N37","O37","P37","Q37",
    "F38","G38","I38",
    "H39",
    "E43","F43","G43","H43","I43","J43","K43",
    "E44","F44","G44","H44","I44","J44","K44",
    "E45","F45","G45","H45","I45","J45","K45",
    "F46","G46","I46",
    "H47",
    "K48",
    "E49","F49","G49","H49","I49","J49","K49",
    "L51",
    "M52",
    "N53","O53","P53","Q53"
)

foreach ($cellRef in $oCellsToMark) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef $cellRef -Text "O"
}

$valueBaseCell = $sheetXml.SelectSingleNode("//x:c[@r='C27']", $sheetNs)
$valueBaseStyleId = if ($valueBaseCell -and $valueBaseCell.HasAttribute("s")) { [int]$valueBaseCell.GetAttribute("s") } else { 0 }
$valueStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -Horizontal "left" -Vertical "center" -WrapText $false
$markerStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -MakeBold $true -Horizontal "center" -Vertical "center" -WrapText $false
$footerStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -Horizontal "center" -Vertical "center" -WrapText $false

$valueRows = @(11..16) + @(18..25) + @(27) + @(29..39) + @(43..49) + @(51..53)
foreach ($row in $valueRows) {
    $cell = $sheetXml.SelectSingleNode("//x:c[@r='C$row']", $sheetNs)
    if ($cell -and $cell.HasChildNodes) {
        $cell.SetAttribute("s", [string]$valueStyleId)
    }
}

$oCells = foreach ($cell in $sheetXml.SelectNodes("//x:c", $sheetNs)) {
    if ([string]$cell.t -ne "s" -or -not $cell.v) {
        continue
    }

    $text = $sharedValues[[int]$cell.v]
    if ($text -eq "O") {
        $cell
    }
}

foreach ($cell in $oCells) {
    $cell.SetAttribute("s", [string]$markerStyleId)
}

$labelCells = @("B10","B17","B23","B26","B28","B31","B36","B42","B50")
foreach ($ref in $labelCells) {
    $cell = $sheetXml.SelectSingleNode("//x:c[@r='$ref']", $sheetNs)
    if ($cell) {
        $baseStyleId = if ($cell.HasAttribute("s")) { [int]$cell.GetAttribute("s") } else { 0 }
        $boldStyleId = Get-OrCreate-BoldStyleId -StylesXml $stylesXml -BaseStyleId $baseStyleId
        $cell.SetAttribute("s", [string]$boldStyleId)
    }
}

foreach ($column in $caseColumns) {
    foreach ($row in 54..56) {
        $cell = $sheetXml.SelectSingleNode("//x:c[@r='${column}${row}']", $sheetNs)
        if ($cell -and $cell.HasChildNodes) {
            $cell.SetAttribute("s", [string]$footerStyleId)
        }
    }
}

foreach ($fontId in 18, 23, 26, 27, 28, 30) {
    Ensure-FontIsNotBold -StylesXml $stylesXml -FontId $fontId
}

$sharedXml.sst.SetAttribute("count", [string]$sharedXml.sst.si.Count)
$sharedXml.sst.SetAttribute("uniqueCount", [string]$sharedXml.sst.si.Count)

$workbookXml.Save($workbookPath)
$sharedXml.Save($sharedStringsPath)
$stylesXml.Save($stylesPath)
$sheetXml.Save($sheetPath)

if (Test-Path -LiteralPath $tempZip) {
    Remove-Item -LiteralPath $tempZip -Force
}
if (Test-Path -LiteralPath $OutputWorkbookPath) {
    Remove-Item -LiteralPath $OutputWorkbookPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $tempZip)
Move-Item -LiteralPath $tempZip -Destination $OutputWorkbookPath -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Output "Generated workbook: $OutputWorkbookPath"
