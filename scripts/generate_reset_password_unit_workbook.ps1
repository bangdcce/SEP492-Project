param(
    [string]$SourceWorkbookPath = "C:\Users\ASUS\Downloads\Unit Test (1).xlsx",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\docs\unit\post-auth-reset-password-unit-test.xlsx"
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
$targetSheet.SetAttribute("name", "Reset Password")
if ($targetSheet.HasAttribute("state")) {
    $targetSheet.RemoveAttribute("state")
}

$workbookView = $workbookXml.SelectSingleNode("//x:bookViews/x:workbookView", $wbNs)
if ($workbookView) {
    $workbookView.SetAttribute("activeTab", "0")
    $workbookView.SetAttribute("firstSheet", "0")
}

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C2" -Text "AUTH-RESET-PASSWORD"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "K2" -Text "Reset Password"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C3" -Text "Codex"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "K3" -Text "Codex"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C5" -Text "Cover POST /auth/reset-password in one UTC sheet with executed Jest evidence."

$allCaseColumns = @("E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U")
$caseColumns = @("E", "F", "G", "H", "I", "J", "K")
$utcHeaders = @{
    E = "UTCID01"; F = "UTCID02"; G = "UTCID03"; H = "UTCID04"; I = "UTCID05"; J = "UTCID06"; K = "UTCID07"
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

Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "A7" -Value "7"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C7" -Value "0"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "E7" -Value "0"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "K7" -Value "1"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "L7" -Value "6"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "M7" -Value "0"
Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "N7" -Value "7"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B10" -Text "Precondition"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C11" -Text "ResetPasswordDto payload passes validation"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C12" -Text "ResetPasswordDto payload fails validation"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C13" -Text "Active account with stored OTP is found"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C14" -Text "Password confirmation matches new password"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C15" -Text "Stored OTP has not expired"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C16" -Text "Submitted OTP matches stored OTP"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B17" -Text "email"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C18" -Text '"member@gmail.com"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C19" -Text '"bad-email"'

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B23" -Text "otp"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C24" -Text '"123456"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C25" -Text '"654321"'
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C26"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B29" -Text "newPassword"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C30" -Text '"newpass123"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C31" -Text '"short1"'
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C32"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C33"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C34"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B35" -Text "confirmPassword"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C36" -Text '"newpass123"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C37" -Text '"short1"'
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C38" -Text '"differentpass123"'
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C39"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C40"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C41"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "A42" -Text "Confirm"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B42" -Text "Return"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C43" -Text "Returns password reset success response"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C44" -Text "Returns reset-password result payload"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C46"
Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "C47"

Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B50" -Text "Exception"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C51" -Text "Returns Validation/BadRequest for invalid reset-password payload"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C52" -Text "Returns Unauthorized: password confirmation mismatch"
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "C53" -Text "Returns Unauthorized: invalid or expired OTP"

$types = @{
    E = "N"; F = "A"; G = "A"; H = "A"; I = "A"; J = "A"; K = "A"
}
foreach ($column in $caseColumns) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}54" -Text $types[$column]
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}55" -Text "P"
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "${column}56" -Text "03-29"
}
Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef "B54" -Text "Type(N : Normal, A : Abnormal, B : Boundary)"

$oCellsToMark = @(
    "E11","H11","I11","J11","K11",
    "F12","G12",
    "E13","J13","K13",
    "E14","F14","G14","I14","J14","K14",
    "E15","K15",
    "E16",
    "E18","G18","H18","I18","J18","K18",
    "F19",
    "E24","F24","G24","H24","I24","J24",
    "K25",
    "E30","F30","H30","I30","J30","K30",
    "G31",
    "E36","F36","I36","J36","K36",
    "G37",
    "H38",
    "E43",
    "E44",
    "F51","G51",
    "H52",
    "I53","J53","K53"
)

foreach ($cellRef in $oCellsToMark) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef $cellRef -Text "O"
}

$valueBaseCell = $sheetXml.SelectSingleNode("//x:c[@r='C27']", $sheetNs)
$valueBaseStyleId = if ($valueBaseCell -and $valueBaseCell.HasAttribute("s")) { [int]$valueBaseCell.GetAttribute("s") } else { 0 }
$valueStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -Horizontal "left" -Vertical "center" -WrapText $false
$markerStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -MakeBold $true -Horizontal "center" -Vertical "center" -WrapText $false
$footerStyleId = Get-OrCreate-StyleVariantId -StylesXml $stylesXml -BaseStyleId $valueBaseStyleId -Horizontal "center" -Vertical "center" -WrapText $false

$valueRows = @(11..16) + @(18..19) + @(24..25) + @(30..31) + @(36..38) + @(43..44) + @(51..53)
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

$labelCells = @("B10","B17","B23","B29","B35","B42","B50")
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
