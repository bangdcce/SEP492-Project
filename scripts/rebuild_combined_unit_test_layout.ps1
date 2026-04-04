param(
    [string]$TemplatePath = "C:\Users\ASUS\Downloads\Unit Testing Excel (1)\Unit Testing Excel\Report5_Unit Test Case_v1.2.xlsx",
    [string]$SourceCombinedPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.0_combined.xlsx",
    [string]$OutputWorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Unit Test Case_v1.2_combined.xlsx",
    [string]$JestResultsPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets\jest-auth-results.json",
    [string]$ReportOwner = "Nguyễn Gia Bảo"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$unitSheetNames = @(
    "Register Account",
    "Verify Email",
    "Resend Verification",
    "Login",
    "Logout",
    "Get Profile",
    "Update Profile",
    "Get Session",
    "Refresh Token",
    "Forgot Password",
    "Verify OTP",
    "Reset Password",
    "Check Obligations",
    "Delete Account",
    "Get CV",
    "Get Skills",
    "Delete CV",
    "Update Bio",
    "Update Skills",
    "Submit KYC",
    "Get My KYC",
    "Get All KYC",
    "Get KYC By ID",
    "Get KYC By ID With Watermark",
    "Approve KYC",
    "Reject KYC",
    "Get Public Domains",
    "Get Public Skills",
    "Get Users",
    "Get User Detail",
    "Ban User",
    "Unban User"
)

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

function Read-XmlFile {
    param([string]$Path)
    return [xml][System.IO.File]::ReadAllText($Path)
}

function Get-SharedStringText {
    param([System.Xml.XmlElement]$Si)

    if ($null -eq $Si) {
        return ""
    }

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

    if ($Si.'#text') {
        return [string]$Si.'#text'
    }

    return ""
}

function Get-ColumnLetters {
    param([string]$CellReference)

    return ([regex]::Match($CellReference, '^[A-Z]+')).Value
}

function Get-ColumnIndex {
    param([string]$ColumnLetters)

    $value = 0
    foreach ($char in $ColumnLetters.ToCharArray()) {
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

function Get-CellText {
    param(
        [System.Xml.XmlElement]$Cell,
        [string[]]$SharedValues,
        [System.Xml.XmlNamespaceManager]$NamespaceManager
    )

    if ($null -eq $Cell) {
        return ""
    }

    $type = $Cell.GetAttribute("t")
    if ($type -eq "s") {
        $valueNode = $Cell.SelectSingleNode("x:v", $NamespaceManager)
        if ($valueNode -ne $null) {
            return $SharedValues[[int]$valueNode.InnerText]
        }
        return ""
    }

    if ($type -eq "inlineStr") {
        $textNode = $Cell.SelectSingleNode("x:is/x:t", $NamespaceManager)
        if ($textNode -ne $null) {
            return [string]$textNode.InnerText
        }
        $runNodes = $Cell.SelectNodes("x:is/x:r/x:t", $NamespaceManager)
        if ($runNodes.Count -gt 0) {
            $text = ""
            foreach ($node in $runNodes) {
                $text += [string]$node.InnerText
            }
            return $text
        }
        return ""
    }

    $valueNode = $Cell.SelectSingleNode("x:v", $NamespaceManager)
    if ($valueNode -ne $null) {
        return [string]$valueNode.InnerText
    }

    return ""
}

function Convert-CellReference {
    param(
        [string]$Reference,
        [int]$NewRowNumber
    )

    $column = Get-ColumnLetters $Reference
    return $column + $NewRowNumber
}

function Clear-CellValue {
    param(
        [System.Xml.XmlElement]$Cell,
        [System.Xml.XmlNamespaceManager]$NamespaceManager
    )

    foreach ($child in @($Cell.ChildNodes)) {
        [void]$Cell.RemoveChild($child)
    }

    if ($Cell.HasAttribute("t")) {
        $Cell.RemoveAttribute("t")
    }
}

function Clear-RowValues {
    param(
        [System.Xml.XmlElement]$Row,
        [System.Xml.XmlNamespaceManager]$NamespaceManager
    )

    foreach ($cell in $Row.SelectNodes("x:c", $NamespaceManager)) {
        Clear-CellValue -Cell $cell -NamespaceManager $NamespaceManager
    }
}

function Get-OrCreateCell {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlElement]$Row,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$ColumnLetters,
        [string]$StyleId
    )

    $cellReference = $ColumnLetters + $Row.GetAttribute("r")
    foreach ($cell in $Row.SelectNodes("x:c", $NamespaceManager)) {
        if ($cell.GetAttribute("r") -eq $cellReference) {
            return $cell
        }
    }

    $cell = $SheetXml.CreateElement("c", $SheetXml.DocumentElement.NamespaceURI)
    $cell.SetAttribute("r", $cellReference)
    if ($StyleId) {
        $cell.SetAttribute("s", $StyleId)
    }

    $existingCells = @($Row.SelectNodes("x:c", $NamespaceManager))
    $newIndex = Get-ColumnIndex $ColumnLetters
    $inserted = $false
    foreach ($existingCell in $existingCells) {
        $existingIndex = Get-ColumnIndex (Get-ColumnLetters $existingCell.GetAttribute("r"))
        if ($existingIndex -gt $newIndex) {
            [void]$Row.InsertBefore($cell, $existingCell)
            $inserted = $true
            break
        }
    }

    if (-not $inserted) {
        [void]$Row.AppendChild($cell)
    }

    return $cell
}

function Set-CellText {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlElement]$Row,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$ColumnLetters,
        [string]$Text,
        [string]$StyleId
    )

    $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -NamespaceManager $NamespaceManager -ColumnLetters $ColumnLetters -StyleId $StyleId
    Clear-CellValue -Cell $cell -NamespaceManager $NamespaceManager
    if ($StyleId) {
        $cell.SetAttribute("s", $StyleId)
    }
    $cell.SetAttribute("t", "inlineStr")
    $isNode = $SheetXml.CreateElement("is", $SheetXml.DocumentElement.NamespaceURI)
    $tNode = $SheetXml.CreateElement("t", $SheetXml.DocumentElement.NamespaceURI)
    if ($Text.StartsWith(" ") -or $Text.EndsWith(" ") -or $Text.Contains("`n")) {
        $spaceAttr = $SheetXml.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
        $spaceAttr.Value = "preserve"
        [void]$tNode.Attributes.Append($spaceAttr)
    }
    $tNode.InnerText = $Text
    [void]$isNode.AppendChild($tNode)
    [void]$cell.AppendChild($isNode)
}

function Set-CellNumber {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlElement]$Row,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$ColumnLetters,
        [string]$NumberText,
        [string]$StyleId
    )

    $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -NamespaceManager $NamespaceManager -ColumnLetters $ColumnLetters -StyleId $StyleId
    Clear-CellValue -Cell $cell -NamespaceManager $NamespaceManager
    if ($StyleId) {
        $cell.SetAttribute("s", $StyleId)
    }
    $vNode = $SheetXml.CreateElement("v", $SheetXml.DocumentElement.NamespaceURI)
    $vNode.InnerText = $NumberText
    [void]$cell.AppendChild($vNode)
}

function Convert-ToExcelSerialDate {
    param([datetime]$Value)

    $baseDate = Get-Date "1899-12-30T00:00:00"
    return [math]::Floor(($Value - $baseDate).TotalDays)
}

function Update-TestReportSheetXml {
    param(
        [xml]$SheetXml,
        [string[]]$UnitSheetNames,
        [hashtable]$SourceModels,
        [string]$ReportOwner
    )

    $ns = New-Object System.Xml.XmlNamespaceManager($SheetXml.NameTable)
    $ns.AddNamespace("x", $SheetXml.DocumentElement.NamespaceURI)

    $sheetData = $SheetXml.SelectSingleNode("//x:sheetData", $ns)
    $rows = @{}
    foreach ($row in $SheetXml.SelectNodes("//x:sheetData/x:row", $ns)) {
        $rows[[int]$row.GetAttribute("r")] = $row
    }

    foreach ($rowNumber in 12..95) {
        if (-not $rows.ContainsKey($rowNumber)) {
            continue
        }
        $row = $rows[$rowNumber]
        foreach ($column in @("A","B","C","D","E","F","G","H","I")) {
            $cell = $row.SelectSingleNode("x:c[starts-with(@r,'$column')]", $ns)
            if ($cell -ne $null) {
                Clear-CellValue -Cell $cell -NamespaceManager $ns
            }
        }
    }

    Set-CellText -SheetXml $SheetXml -Row $rows[4] -NamespaceManager $ns -ColumnLetters "B" -Text "SEP492-Project" -StyleId "301"
    Set-CellText -SheetXml $SheetXml -Row $rows[4] -NamespaceManager $ns -ColumnLetters "F" -Text $ReportOwner -StyleId "305"
    Set-CellText -SheetXml $SheetXml -Row $rows[5] -NamespaceManager $ns -ColumnLetters "B" -Text "SEP492" -StyleId "301"
    Set-CellText -SheetXml $SheetXml -Row $rows[5] -NamespaceManager $ns -ColumnLetters "F" -Text $ReportOwner -StyleId "305"
    Set-CellText -SheetXml $SheetXml -Row $rows[6] -NamespaceManager $ns -ColumnLetters "B" -Text "SEP492_Unit Test Report_v1.2" -StyleId "301"
    Set-CellNumber -SheetXml $SheetXml -Row $rows[6] -NamespaceManager $ns -ColumnLetters "F" -NumberText ([string](Convert-ToExcelSerialDate -Value (Get-Date).Date)) -StyleId "298"

    $hyperlinksNode = $SheetXml.SelectSingleNode("//x:hyperlinks", $ns)
    if ($hyperlinksNode -ne $null) {
        while ($hyperlinksNode.HasChildNodes) {
            [void]$hyperlinksNode.RemoveChild($hyperlinksNode.FirstChild)
        }
    }

    for ($i = 0; $i -lt $UnitSheetNames.Count; $i++) {
        $sheetName = $UnitSheetNames[$i]
        $model = $SourceModels[$sheetName]
        if ($null -eq $model -or $null -eq $model.header) {
            continue
        }

        $rowNumber = 12 + $i
        if (-not $rows.ContainsKey($rowNumber)) {
            continue
        }

        $row = $rows[$rowNumber]
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "A" -NumberText ([string]($i + 1)) -StyleId "277"
        Set-CellText -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "B" -Text $model.header.functionName -StyleId "262"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "C" -NumberText ([string]$model.header.passed) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "D" -NumberText ([string]$model.header.failed) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "E" -NumberText ([string]$model.header.untested) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "F" -NumberText ([string]$model.header.nCount) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "G" -NumberText ([string]$model.header.aCount) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "H" -NumberText ([string]$model.header.bCount) -StyleId "59"
        Set-CellNumber -SheetXml $SheetXml -Row $row -NamespaceManager $ns -ColumnLetters "I" -NumberText ([string]$model.header.totalTestCases) -StyleId "59"

        if ($hyperlinksNode -eq $null) {
            $hyperlinksNode = $SheetXml.CreateElement("hyperlinks", $SheetXml.DocumentElement.NamespaceURI)
            [void]$SheetXml.DocumentElement.AppendChild($hyperlinksNode)
        }

        $hyperlink = $SheetXml.CreateElement("hyperlink", $SheetXml.DocumentElement.NamespaceURI)
        $hyperlink.SetAttribute("ref", "B$rowNumber")
        $escapedSheetName = $sheetName.Replace("'", "''")
        $hyperlink.SetAttribute("location", "'$escapedSheetName'!A1")
        $hyperlink.SetAttribute("display", $model.header.functionName)
        [void]$hyperlinksNode.AppendChild($hyperlink)
    }
}

function Parse-SourceSheetModel {
    param(
        [xml]$SheetXml,
        [string[]]$SharedValues,
        [string]$SheetName
    )

    $ns = New-Object System.Xml.XmlNamespaceManager($SheetXml.NameTable)
    $ns.AddNamespace("x", $SheetXml.DocumentElement.NamespaceURI)

    $rows = @{}
    foreach ($row in $SheetXml.SelectNodes("//x:sheetData/x:row", $ns)) {
        $rows[[int]$row.GetAttribute("r")] = $row
    }

    $row9 = $rows[9]
    $utcColumns = @()
    $utcIds = @()
    foreach ($cell in $row9.SelectNodes("x:c", $ns)) {
        $text = Get-CellText -Cell $cell -SharedValues $SharedValues -NamespaceManager $ns
        if ($text -like "UTCID*") {
            $utcColumns += Get-ColumnLetters $cell.GetAttribute("r")
            $utcIds += $text
        }
    }

    $conditionRow = $null
    $confirmRow = $null
    $resultRow = $null
    foreach ($rowNumber in ($rows.Keys | Sort-Object)) {
        $row = $rows[$rowNumber]
        $aCell = $row.SelectSingleNode("x:c[starts-with(@r,'A')]", $ns)
        $aText = Get-CellText -Cell $aCell -SharedValues $SharedValues -NamespaceManager $ns
        switch ($aText) {
            "Condition" {
                if ($null -eq $conditionRow) {
                    $conditionRow = $rowNumber
                }
            }
            "Confirm" {
                if ($null -eq $confirmRow) {
                    $confirmRow = $rowNumber
                }
            }
            "Result" {
                if ($null -eq $resultRow) {
                    $resultRow = $rowNumber
                }
            }
        }
    }

    if ($null -eq $conditionRow -or $null -eq $confirmRow -or $null -eq $resultRow) {
        throw "Failed to parse source layout for sheet '$SheetName'"
    }

    $preconditions = New-Object 'System.Collections.Generic.List[object]'
    $fields = New-Object 'System.Collections.Generic.List[object]'
    $currentField = $null
    $isPrecondition = $true

    foreach ($rowNumber in (($conditionRow + 1)..($confirmRow - 1))) {
        if (-not $rows.ContainsKey($rowNumber)) {
            continue
        }
        $row = $rows[$rowNumber]
        $bCell = $row.SelectSingleNode("x:c[starts-with(@r,'B')]", $ns)
        $cCell = $row.SelectSingleNode("x:c[starts-with(@r,'C')]", $ns)
        $bText = Get-CellText -Cell $bCell -SharedValues $SharedValues -NamespaceManager $ns
        $cText = Get-CellText -Cell $cCell -SharedValues $SharedValues -NamespaceManager $ns

        if ($bText -ne "") {
            $currentField = [ordered]@{
                name = $bText
                values = New-Object 'System.Collections.Generic.List[object]'
            }
            $fields.Add($currentField)
            $isPrecondition = $false
            continue
        }

        if ($cText -eq "") {
            continue
        }

        $cases = New-Object 'System.Collections.Generic.List[int]'
        for ($i = 0; $i -lt $utcColumns.Count; $i++) {
            $column = $utcColumns[$i]
            $cell = $row.SelectSingleNode("x:c[starts-with(@r,'$column')]", $ns)
            $cellText = Get-CellText -Cell $cell -SharedValues $SharedValues -NamespaceManager $ns
            if ($cellText -eq "O") {
                $cases.Add($i)
            }
        }

        $value = [ordered]@{
            text = $cText
            cases = $cases
        }

        if ($isPrecondition) {
            $preconditions.Add($value)
        }
        elseif ($currentField -ne $null) {
            $currentField.values.Add($value)
        }
    }

    $confirmSections = New-Object 'System.Collections.Generic.List[object]'
    $currentSection = $null
    foreach ($rowNumber in ($confirmRow..($resultRow - 1))) {
        if (-not $rows.ContainsKey($rowNumber)) {
            continue
        }
        $row = $rows[$rowNumber]
        $bCell = $row.SelectSingleNode("x:c[starts-with(@r,'B')]", $ns)
        $cCell = $row.SelectSingleNode("x:c[starts-with(@r,'C')]", $ns)
        $bText = Get-CellText -Cell $bCell -SharedValues $SharedValues -NamespaceManager $ns
        $cText = Get-CellText -Cell $cCell -SharedValues $SharedValues -NamespaceManager $ns

        if ($bText -eq "Type(N : Normal, A : Abnormal, B : Boundary)" -or
            $bText -eq "Passed/Failed" -or
            $bText -eq "Executed Date" -or
            $bText -eq "Defect ID") {
            continue
        }

        if ($bText -ne "") {
            $currentSection = [ordered]@{
                name = $bText
                values = New-Object 'System.Collections.Generic.List[object]'
            }
            $confirmSections.Add($currentSection)
            continue
        }

        if ($cText -eq "" -or $null -eq $currentSection) {
            continue
        }

        $cases = New-Object 'System.Collections.Generic.List[int]'
        for ($i = 0; $i -lt $utcColumns.Count; $i++) {
            $column = $utcColumns[$i]
            $cell = $row.SelectSingleNode("x:c[starts-with(@r,'$column')]", $ns)
            $cellText = Get-CellText -Cell $cell -SharedValues $SharedValues -NamespaceManager $ns
            if ($cellText -eq "O") {
                $cases.Add($i)
            }
        }

        $currentSection.values.Add([ordered]@{
            text = $cText
            cases = $cases
        })
    }

    $footer = [ordered]@{
        types = @()
        status = @()
        dates = @()
        defects = @()
    }

    $footerMap = @{
        "Type(N : Normal, A : Abnormal, B : Boundary)" = "types"
        "Passed/Failed" = "status"
        "Executed Date" = "dates"
        "Defect ID" = "defects"
    }

    foreach ($rowNumber in ($resultRow..($resultRow + 3))) {
        if (-not $rows.ContainsKey($rowNumber)) {
            continue
        }
        $row = $rows[$rowNumber]
        $bCell = $row.SelectSingleNode("x:c[starts-with(@r,'B')]", $ns)
        $bText = Get-CellText -Cell $bCell -SharedValues $SharedValues -NamespaceManager $ns
        if (-not $footerMap.ContainsKey($bText)) {
            continue
        }

        $values = @()
        for ($i = 0; $i -lt $utcColumns.Count; $i++) {
            $column = $utcColumns[$i]
            $cell = $row.SelectSingleNode("x:c[starts-with(@r,'$column')]", $ns)
            $values += (Get-CellText -Cell $cell -SharedValues $SharedValues -NamespaceManager $ns)
        }
        $footer[$footerMap[$bText]] = $values
    }

    return [ordered]@{
        name = $SheetName
        utcIds = $utcIds
        preconditions = $preconditions
        fields = $fields
        confirmSections = $confirmSections
        footer = $footer
    }
}

function New-CaseList {
    param([int]$Index)

    $cases = New-Object 'System.Collections.Generic.List[int]'
    $cases.Add($Index)
    return $cases
}

function Get-JestAssertionLookup {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Jest results file not found: $Path"
    }

    $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $lookup = @{}

    foreach ($suite in $json.testResults) {
        foreach ($assertion in $suite.assertionResults) {
            $lookup[$assertion.fullName] = [ordered]@{
                title = [string]$assertion.title
                fullName = [string]$assertion.fullName
                suiteFile = [string]$suite.name
                status = [string]$assertion.status
            }
        }
    }

    return $lookup
}

function Get-SheetEndpointMap {
    $map = [ordered]@{}
    $map["Register Account"] = "POST /auth/register"
    $map["Verify Email"] = "GET /auth/verify-email"
    $map["Resend Verification"] = "POST /auth/resend-verification"
    $map["Login"] = "POST /auth/login"
    $map["Logout"] = "POST /auth/logout"
    $map["Get Profile"] = "GET /auth/profile"
    $map["Update Profile"] = "PUT /auth/profile"
    $map["Get Session"] = "GET /auth/session"
    $map["Refresh Token"] = "POST /auth/refresh"
    $map["Forgot Password"] = "POST /auth/forgot-password"
    $map["Verify OTP"] = "POST /auth/verify-otp"
    $map["Reset Password"] = "POST /auth/reset-password"
    $map["Check Obligations"] = "GET /auth/check-obligations"
    $map["Delete Account"] = "POST /auth/delete-account"
    $map["Get CV"] = "GET /profile/cv"
    $map["Get Skills"] = "GET /profile/skills"
    $map["Delete CV"] = "DELETE /profile/cv"
    $map["Update Bio"] = "PATCH /profile/bio"
    $map["Update Skills"] = "PUT /profile/skills"
    $map["Submit KYC"] = "POST /kyc"
    $map["Get My KYC"] = "GET /kyc/me"
    $map["Get All KYC"] = "GET /kyc/admin/all"
    $map["Get KYC By ID"] = "GET /kyc/admin/:id"
    $map["Get KYC By ID With Watermark"] = "GET /kyc/admin/:id/watermark"
    $map["Approve KYC"] = "PATCH /kyc/admin/:id/approve"
    $map["Reject KYC"] = "PATCH /kyc/admin/:id/reject"
    $map["Get Public Domains"] = "GET /public/skills/domains"
    $map["Get Public Skills"] = "GET /public/skills/skills"
    $map["Get Users"] = "GET /users"
    $map["Get User Detail"] = "GET /users/:id"
    $map["Ban User"] = "PATCH /users/:id/ban"
    $map["Unban User"] = "PATCH /users/:id/unban"
    return $map
}

function Get-SheetLogDefinitions {
    $definitions = [ordered]@{}

    $definitions["Register Account"] = @(
        "RegisterDto accepts a valid self-registration payload",
        "AuthService.register registers a client account and records verification metadata",
        "AuthService.register persists selected domains and skills for a freelancer registration",
        "AuthService.register persists selected domains and skills for a broker registration",
        "AuthService.register throws a conflict when the email is already registered",
        "RegisterDto rejects malformed email addresses before business logic runs",
        "RegisterDto rejects an invalid Vietnamese phone number",
        "RegisterDto rejects full names that contain unsupported characters",
        "RegisterDto rejects email domains outside the trusted-provider list",
        "RegisterDto rejects passwords that miss the required numeric or special character",
        "AuthService.register throws a conflict when legal consent is missing",
        "CaptchaGuard rejects requests without a token when reCAPTCHA is enabled",
        "CaptchaGuard rejects requests with an invalid token when reCAPTCHA is enabled"
    )

    $definitions["Verify Email"] = @(
        "EmailVerificationService.verifyEmail verifies the email when the token is valid and clears verification fields",
        "EmailVerificationService.verifyEmail rejects when the token is missing",
        "EmailVerificationService.verifyEmail rejects when the token does not match any user",
        "EmailVerificationService.verifyEmail rejects when the account has been deleted",
        "EmailVerificationService.verifyEmail rejects when the email has already been verified",
        "EmailVerificationService.verifyEmail rejects when the token has expired"
    )

    $definitions["Resend Verification"] = @(
        "EmailVerificationService.resendVerificationEmail resends verification email when the user exists and is not verified",
        "EmailVerificationService.resendVerificationEmail allows resend when the previous verification window is below the cooldown threshold",
        "EmailVerificationService.resendVerificationEmail rejects when the email does not belong to any user",
        "EmailVerificationService.resendVerificationEmail rejects when the email has already been verified",
        "EmailVerificationService.resendVerificationEmail rejects when the resend request arrives too soon after the previous email"
    )

    $definitions["Login"] = @(
        "LoginDto accepts a valid login payload",
        "AuthService.login returns tokens, creates a session, and updates timezone when login succeeds",
        "LoginDto rejects an invalid email format",
        "LoginDto rejects a missing email value",
        "LoginDto rejects passwords shorter than eight characters",
        "AuthService.login throws unauthorized when the email does not exist",
        "AuthService.login throws unauthorized when the password is incorrect",
        "AuthService.login throws unauthorized when the email is not verified"
    )

    $definitions["Logout"] = @(
        "AuthController.logout passes the authenticated user id and refresh token to the service, then clears auth cookies",
        "AuthService.logout revokes the directly matched session when a refresh token fingerprint exists",
        "AuthService.logout falls back to bcrypt comparison and revokes the matched legacy session",
        "AuthService.logout revokes all active sessions when no refresh token is provided"
    )

    $definitions["Get Profile"] = @(
        "AuthController.getProfile returns the authenticated profile with merged core and profile fields",
        "AuthController.getProfile preserves falsy profile values when mapping the authenticated profile response",
        "AuthController.getProfile returns persisted account fields from the database instead of the sparse JWT payload",
        "AuthController.getProfile returns account details even when the profile relation is missing",
        "AuthController.getProfile rejects profile viewing when the authenticated user can no longer be loaded"
    )

    $definitions["Update Profile"] = @(
        "UpdateProfileDto accepts a valid partial profile update payload",
        "AuthService.updateProfile updates user fields and the existing profile, then returns the mapped response",
        "AuthService.updateProfile creates a new profile when the user does not have one yet",
        "UpdateProfileDto rejects an invalid phone number",
        "AuthService.updateProfile throws when the user can no longer be loaded after the update completes"
    )

    $definitions["Get Session"] = @(
        "AuthService.getSessionUser returns the mapped authenticated session user when the account still exists",
        "AuthService.getSessionUser returns the session snapshot even when the profile relation is missing",
        "AuthService.getSessionUser throws unauthorized when the authenticated session owner no longer exists"
    )

    $definitions["Refresh Token"] = @(
        "AuthService.refreshToken rejects when the refresh token is missing",
        "AuthService.refreshToken rejects when the refresh token does not match any stored session",
        "AuthService.refreshToken rejects when the matched session has already been revoked",
        "AuthService.refreshToken rejects and revokes the session when the matched refresh token has expired",
        "AuthService.refreshToken rejects when the session owner can no longer be loaded",
        "AuthService.refreshToken rotates tokens and updates the persisted session when the refresh token is valid"
    )

    $definitions["Forgot Password"] = @(
        "ForgotPasswordDto accepts a valid forgot-password payload",
        "ForgotPasswordDto rejects an invalid email address",
        "AuthService.forgotPassword stores an OTP and returns the masked email when the account is active",
        "AuthService.forgotPassword rejects when the account does not exist or is inactive",
        "AuthService.forgotPassword still returns success when OTP email delivery fails"
    )

    $definitions["Verify OTP"] = @(
        "VerifyOtpDto accepts a valid verify-otp payload",
        "VerifyOtpDto rejects OTP values that are not six digits",
        "AuthService.verifyOtp returns a valid result when the submitted OTP matches the stored code",
        "AuthService.verifyOtp returns an invalid result when the OTP does not match",
        "AuthService.verifyOtp returns an expired result when the stored OTP has passed its expiry time"
    )

    $definitions["Reset Password"] = @(
        "ResetPasswordDto accepts a valid reset-password payload",
        "ResetPasswordDto rejects passwords shorter than eight characters",
        "ResetPasswordDto rejects passwords without a lowercase letter and number or special character",
        "ResetPasswordDto rejects an empty confirmation password",
        "AuthService.resetPassword hashes the new password, clears OTP state, and revokes sessions when reset succeeds",
        "AuthService.resetPassword rejects when password confirmation does not match",
        "AuthService.resetPassword rejects when the stored OTP has expired"
    )

    $definitions["Check Obligations"] = @(
        "AuthService.checkActiveObligations returns hasObligations true when active projects or wallet balance exist",
        "AuthService.checkActiveObligations returns hasObligations false when there are no active projects and no wallet balance",
        "AuthService.checkActiveObligations returns hasObligations true when only wallet balance remains"
    )

    $definitions["Delete Account"] = @(
        "DeleteAccountDto accepts a valid delete-account payload",
        "AuthService.deleteAccount revokes sessions, anonymizes account data, and returns success when deletion is allowed",
        "DeleteAccountDto rejects an empty password",
        "DeleteAccountDto rejects passwords shorter than six characters",
        "AuthService.deleteAccount rejects when the password is incorrect",
        "AuthService.deleteAccount rejects when active obligations still exist"
    )

    $definitions["Get CV"] = @(
        "ProfileController.getCV returns null when the user has no CV",
        "ProfileController.getCV returns the stored public CV URL as-is",
        "ProfileController.getCV returns a signed CV URL when the stored value is a storage path",
        "ProfileController.getCV throws not found when the storage path cannot be signed"
    )

    $definitions["Get Skills"] = @(
        "ProfileController.getMySkills returns mapped skills with full details for the authenticated user",
        "ProfileController.getMySkills returns an empty skills array when the user has not added any skills"
    )

    $definitions["Delete CV"] = @(
        "ProfileController.deleteCV deletes a stored CV path and clears the profile reference",
        "ProfileController.deleteCV extracts the storage path from a public CV URL before deletion",
        "ProfileController.deleteCV throws not found when the user has no CV to delete",
        "ProfileController.deleteCV still clears the database reference when storage deletion reports an error",
        "ProfileController.deleteCV throws bad request when clearing the CV reference fails"
    )

    $definitions["Update Bio"] = @(
        "ProfileController.updateBio creates a profile and stores the trimmed bio when none exists",
        "ProfileController.updateBio updates the existing profile bio with trimmed content",
        "ProfileController.updateBio rejects empty bio content",
        "ProfileController.updateBio rejects bio values longer than one thousand characters"
    )

    $definitions["Update Skills"] = @(
        "ProfileController.updateSkills rejects requests when skillIds is not an array",
        "ProfileController.updateSkills rejects requests when the skill list is empty",
        "ProfileController.updateSkills rejects requests when one or more submitted skill ids are invalid",
        "ProfileController.updateSkills replaces the skill set and returns the added and removed counts",
        "ProfileController.updateSkills returns zero added and removed counts when the submitted skills already match"
    )

    $definitions["Submit KYC"] = @(
        "SubmitKycDto accepts a valid KYC submission payload",
        "KycController.submitKyc extracts single files from upload arrays and forwards them to the service",
        "KycController.submitKyc forwards undefined file values when upload arrays are missing",
        "KycController.submitKyc rethrows service errors for incomplete KYC document submissions",
        "SubmitKycDto rejects applicants younger than eighteen years old",
        "SubmitKycDto rejects expired identity documents",
        "SubmitKycDto rejects unsupported document types"
    )

    $definitions["Get My KYC"] = @(
        "KycController.getMyKyc forwards the authenticated user id and returns the current KYC submission",
        "KycController.getMyKyc returns the empty-state payload when the user has not submitted KYC yet",
        "KycController.getMyKyc rethrows not-found errors from the service layer"
    )

    $definitions["Get All KYC"] = @(
        "KycController.getAllKyc forwards status and pagination filters to the service",
        "KycController.getAllKyc forwards undefined filters when query parameters are omitted",
        "KycController.getAllKyc rethrows service errors for invalid admin KYC queries"
    )

    $definitions["Get KYC By ID"] = @(
        "KycController.getKycById forwards the KYC id to the service and returns the detail payload",
        "KycController.getKycById rethrows not-found errors when the KYC record does not exist"
    )

    $definitions["Get KYC By ID With Watermark"] = @(
        "KycController.getKycByIdWithWatermark forwards reviewer metadata, request metadata, and reason fields to the service",
        "KycController.getKycByIdWithWatermark falls back to Unknown IP, Unknown Device, and generated session id when request metadata is missing",
        "KycController.getKycByIdWithWatermark rethrows not-found errors when the service cannot load the KYC record"
    )

    $definitions["Approve KYC"] = @(
        "KycController.approveKyc forwards the KYC id and admin id to the service and returns the approval payload",
        "KycController.approveKyc rethrows bad-request errors when the KYC record is not pending",
        "KycController.approveKyc rethrows not-found errors when the KYC record does not exist"
    )

    $definitions["Reject KYC"] = @(
        "KycController.rejectKyc forwards the KYC id, admin id, and rejection payload to the service",
        "KycController.rejectKyc rethrows bad-request errors when the rejection request is invalid",
        "KycController.rejectKyc rethrows not-found errors when the KYC record cannot be found"
    )

    $definitions["Get Public Domains"] = @(
        "PublicSkillsController.getDomains returns active domains ordered for registration",
        "PublicSkillsController.getDomains returns an empty array when no active domains exist"
    )

    $definitions["Get Public Skills"] = @(
        "PublicSkillsController.getSkills returns all active skills when role is omitted",
        "PublicSkillsController.getSkills filters active skills for freelancer registration when role is FREELANCER",
        "PublicSkillsController.getSkills filters active skills for broker registration when role is BROKER",
        "PublicSkillsController.getSkills falls back to all active skills when role is unsupported"
    )

    $definitions["Get Users"] = @(
        "UsersService.getAllUsers returns paginated users with default page and limit when filters are omitted",
        "UsersService.getAllUsers applies the role filter before querying users",
        "UsersService.getAllUsers applies the search filter to both email and full name",
        "UsersService.getAllUsers applies the ban-status filter when isBanned is provided",
        "UsersService.getAllUsers uses custom pagination values and returns totalPages 0 for an empty result set"
    )

    $definitions["Get User Detail"] = @(
        "UsersService.getUserDetail returns detailed user info with signed KYC document URLs when a KYC record exists",
        "UsersService.getUserDetail returns NOT_STARTED KYC state when the user has no KYC submission",
        "UsersService.getUserDetail throws not found when the user does not exist",
        "UsersController.getUserDetail forwards the user id and returns the detailed user payload",
        "UsersController.getUserDetail rethrows not-found errors from the service layer"
    )

    $definitions["Ban User"] = @(
        "UsersController.banUser forwards the user id, admin id, and reason payload to the service",
        "UsersService.banUser marks the user as banned, stores the reason, and records the acting admin",
        "UsersController.banUser rethrows bad-request errors when the user is already banned",
        "UsersService.banUser throws not found when the user cannot be loaded",
        "UsersService.banUser throws bad request when the user is already banned"
    )

    $definitions["Unban User"] = @(
        "UsersController.unbanUser forwards the user id, admin id, and reason payload to the service",
        "UsersService.unbanUser clears ban metadata and returns the updated user when unban succeeds",
        "UsersController.unbanUser rethrows bad-request errors when the user is not currently banned",
        "UsersService.unbanUser throws not found when the user cannot be loaded",
        "UsersService.unbanUser throws bad request when the user is not currently banned"
    )

    return $definitions
}

function New-ValueEntry {
    param(
        [string]$Text,
        [int[]]$Cases
    )

    $caseList = New-Object 'System.Collections.Generic.List[int]'
    foreach ($case in $Cases) {
        $caseList.Add($case)
    }

    return [ordered]@{
        text = $Text
        cases = $caseList
    }
}

function New-FieldSection {
    param(
        [string]$Name,
        [object[]]$Values
    )

    $valueList = New-Object 'System.Collections.Generic.List[object]'
    foreach ($value in $Values) {
        $valueList.Add($value)
    }

    return [ordered]@{
        name = $Name
        values = $valueList
    }
}

function New-ConfirmSection {
    param(
        [string]$Name,
        [object[]]$Values
    )

    $valueList = New-Object 'System.Collections.Generic.List[object]'
    foreach ($value in $Values) {
        $valueList.Add($value)
    }

    return [ordered]@{
        name = $Name
        values = $valueList
    }
}

function Get-SupplementalSheetModels {
    $models = @{}

    $models["Delete CV"] = [ordered]@{
        name = "Delete CV"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","A","A")
            status = @("P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","")
        }
    }
    $models["Delete CV"].preconditions.Add((New-ValueEntry -Text "Authenticated user is available" -Cases @(0,1,2,3,4)))
    $models["Delete CV"].preconditions.Add((New-ValueEntry -Text "Profile contains a CV reference" -Cases @(0,1,3,4)))
    $models["Delete CV"].fields.Add((New-FieldSection -Name "cvUrl" -Values @(
        (New-ValueEntry -Text '"cvs/user-1/member-cv.pdf"' -Cases @(0,3,4)),
        (New-ValueEntry -Text '"public URL containing cvs path"' -Cases @(1)),
        (New-ValueEntry -Text '"missing or empty"' -Cases @(2))
    )))
    $models["Delete CV"].fields.Add((New-FieldSection -Name "storage remove result" -Values @(
        (New-ValueEntry -Text '"success"' -Cases @(0,1,4)),
        (New-ValueEntry -Text '"error returned"' -Cases @(3))
    )))
    $models["Delete CV"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns CV deleted success response" -Cases @(0,1,3))
    )))
    $models["Delete CV"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns NotFoundException when no CV exists" -Cases @(2)),
        (New-ValueEntry -Text "Returns BadRequestException when profile cleanup fails" -Cases @(4))
    )))

    $models["Update Bio"] = [ordered]@{
        name = "Update Bio"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","B")
            status = @("P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30")
            defects = @("","","","")
        }
    }
    $models["Update Bio"].preconditions.Add((New-ValueEntry -Text "Authenticated user is available" -Cases @(0,1,2,3)))
    $models["Update Bio"].fields.Add((New-FieldSection -Name "profile state" -Values @(
        (New-ValueEntry -Text '"profile missing"' -Cases @(0)),
        (New-ValueEntry -Text '"profile exists"' -Cases @(1))
    )))
    $models["Update Bio"].fields.Add((New-FieldSection -Name "bio" -Values @(
        (New-ValueEntry -Text '"  Refined bio  "' -Cases @(0)),
        (New-ValueEntry -Text '"  Updated bio  "' -Cases @(1)),
        (New-ValueEntry -Text '"whitespace only"' -Cases @(2)),
        (New-ValueEntry -Text '"1001 characters"' -Cases @(3))
    )))
    $models["Update Bio"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns bio updated success response" -Cases @(0,1))
    )))
    $models["Update Bio"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException for empty bio" -Cases @(2)),
        (New-ValueEntry -Text "Returns BadRequestException for bio length > 1000" -Cases @(3))
    )))

    $models["Update Skills"] = [ordered]@{
        name = "Update Skills"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("A","A","A","N","N")
            status = @("P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","")
        }
    }
    $models["Update Skills"].preconditions.Add((New-ValueEntry -Text "Authenticated user is available" -Cases @(0,1,2,3,4)))
    $models["Update Skills"].preconditions.Add((New-ValueEntry -Text "All submitted skill ids exist in repository" -Cases @(3,4)))
    $models["Update Skills"].preconditions.Add((New-ValueEntry -Text "Current skills differ from requested list" -Cases @(3)))
    $models["Update Skills"].preconditions.Add((New-ValueEntry -Text "Current skills already match requested list" -Cases @(4)))
    $models["Update Skills"].fields.Add((New-FieldSection -Name "skillIds" -Values @(
        (New-ValueEntry -Text '"not an array"' -Cases @(0)),
        (New-ValueEntry -Text '"empty array"' -Cases @(1)),
        (New-ValueEntry -Text '"contains invalid skill id"' -Cases @(2)),
        (New-ValueEntry -Text '"[skill-1, skill-2]"' -Cases @(3,4))
    )))
    $models["Update Skills"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns skills updated response with add/remove counts" -Cases @(3)),
        (New-ValueEntry -Text "Returns skills updated response with zero changes" -Cases @(4))
    )))
    $models["Update Skills"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException when skillIds is not an array" -Cases @(0)),
        (New-ValueEntry -Text "Returns BadRequestException when skill list is empty" -Cases @(1)),
        (New-ValueEntry -Text "Returns BadRequestException when one or more skill ids are invalid" -Cases @(2))
    )))

    $models["Submit KYC"] = [ordered]@{
        name = "Submit KYC"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05","UTCID06","UTCID07")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","A","A","A","A")
            status = @("P","P","P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","","","")
        }
    }
    $models["Submit KYC"].preconditions.Add((New-ValueEntry -Text "Authenticated user is available" -Cases @(0,1,2,3,4,5,6)))
    $models["Submit KYC"].preconditions.Add((New-ValueEntry -Text "Service accepts a complete KYC submission" -Cases @(0,1)))
    $models["Submit KYC"].fields.Add((New-FieldSection -Name "document payload" -Values @(
        (New-ValueEntry -Text '"valid DTO and all 3 files"' -Cases @(0,1)),
        (New-ValueEntry -Text '"missing uploaded file arrays"' -Cases @(2,3)),
        (New-ValueEntry -Text '"underage date of birth"' -Cases @(4)),
        (New-ValueEntry -Text '"expired document expiry date"' -Cases @(5)),
        (New-ValueEntry -Text '"unsupported document type"' -Cases @(6))
    )))
    $models["Submit KYC"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns submitted KYC response" -Cases @(0,1))
    )))
    $models["Submit KYC"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException for incomplete document submission" -Cases @(2,3)),
        (New-ValueEntry -Text "Returns validation error for underage applicant" -Cases @(4)),
        (New-ValueEntry -Text "Returns validation error for expired document" -Cases @(5)),
        (New-ValueEntry -Text "Returns validation error for unsupported document type" -Cases @(6))
    )))

    $models["Get My KYC"] = [ordered]@{
        name = "Get My KYC"
        utcIds = @("UTCID01","UTCID02","UTCID03")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A")
            status = @("P","P","P")
            dates = @("03-30","03-30","03-30")
            defects = @("","","")
        }
    }
    $models["Get My KYC"].preconditions.Add((New-ValueEntry -Text "Authenticated user is available" -Cases @(0,1,2)))
    $models["Get My KYC"].fields.Add((New-FieldSection -Name "kyc state" -Values @(
        (New-ValueEntry -Text '"existing KYC submission"' -Cases @(0)),
        (New-ValueEntry -Text '"no KYC submission yet"' -Cases @(1)),
        (New-ValueEntry -Text '"service raises not found"' -Cases @(2))
    )))
    $models["Get My KYC"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns current KYC submission" -Cases @(0)),
        (New-ValueEntry -Text "Returns empty-state KYC message" -Cases @(1))
    )))
    $models["Get My KYC"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns NotFoundException when service cannot locate KYC record" -Cases @(2))
    )))

    $models["Get All KYC"] = [ordered]@{
        name = "Get All KYC"
        utcIds = @("UTCID01","UTCID02","UTCID03")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A")
            status = @("P","P","P")
            dates = @("03-30","03-30","03-30")
            defects = @("","","")
        }
    }
    $models["Get All KYC"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2)))
    $models["Get All KYC"].fields.Add((New-FieldSection -Name "query" -Values @(
        (New-ValueEntry -Text '"status=PENDING, page=2, limit=10"' -Cases @(0)),
        (New-ValueEntry -Text '"status/page/limit omitted"' -Cases @(1)),
        (New-ValueEntry -Text '"invalid status filter"' -Cases @(2))
    )))
    $models["Get All KYC"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns paginated KYC list" -Cases @(0,1))
    )))
    $models["Get All KYC"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException for invalid KYC query" -Cases @(2))
    )))

    $models["Get KYC By ID"] = [ordered]@{
        name = "Get KYC By ID"
        utcIds = @("UTCID01","UTCID02")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","A")
            status = @("P","P")
            dates = @("03-30","03-30")
            defects = @("","")
        }
    }
    $models["Get KYC By ID"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1)))
    $models["Get KYC By ID"].fields.Add((New-FieldSection -Name "id" -Values @(
        (New-ValueEntry -Text '"existing kyc id"' -Cases @(0)),
        (New-ValueEntry -Text '"missing kyc id"' -Cases @(1))
    )))
    $models["Get KYC By ID"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns KYC detail payload" -Cases @(0))
    )))
    $models["Get KYC By ID"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns NotFoundException when KYC record does not exist" -Cases @(1))
    )))

    $models["Get KYC By ID With Watermark"] = [ordered]@{
        name = "Get KYC By ID With Watermark"
        utcIds = @("UTCID01","UTCID02","UTCID03")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A")
            status = @("P","P","P")
            dates = @("03-30","03-30","03-30")
            defects = @("","","")
        }
    }
    $models["Get KYC By ID With Watermark"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2)))
    $models["Get KYC By ID With Watermark"].fields.Add((New-FieldSection -Name "request metadata" -Values @(
        (New-ValueEntry -Text '"explicit ip, user-agent, request-id, and reason"' -Cases @(0)),
        (New-ValueEntry -Text '"missing request metadata"' -Cases @(1)),
        (New-ValueEntry -Text '"service raises not found"' -Cases @(2))
    )))
    $models["Get KYC By ID With Watermark"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns watermarked KYC detail payload" -Cases @(0,1))
    )))
    $models["Get KYC By ID With Watermark"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns NotFoundException when watermarked KYC record does not exist" -Cases @(2))
    )))

    $models["Approve KYC"] = [ordered]@{
        name = "Approve KYC"
        utcIds = @("UTCID01","UTCID02","UTCID03")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","A","A")
            status = @("P","P","P")
            dates = @("03-30","03-30","03-30")
            defects = @("","","")
        }
    }
    $models["Approve KYC"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2)))
    $models["Approve KYC"].fields.Add((New-FieldSection -Name "approval state" -Values @(
        (New-ValueEntry -Text '"existing pending KYC id"' -Cases @(0)),
        (New-ValueEntry -Text '"non-pending KYC record"' -Cases @(1)),
        (New-ValueEntry -Text '"missing KYC record"' -Cases @(2))
    )))
    $models["Approve KYC"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns approved KYC payload" -Cases @(0))
    )))
    $models["Approve KYC"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException when KYC is not pending" -Cases @(1)),
        (New-ValueEntry -Text "Returns NotFoundException when KYC record does not exist" -Cases @(2))
    )))

    $models["Reject KYC"] = [ordered]@{
        name = "Reject KYC"
        utcIds = @("UTCID01","UTCID02","UTCID03")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","A","A")
            status = @("P","P","P")
            dates = @("03-30","03-30","03-30")
            defects = @("","","")
        }
    }
    $models["Reject KYC"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2)))
    $models["Reject KYC"].fields.Add((New-FieldSection -Name "rejection request" -Values @(
        (New-ValueEntry -Text '"valid rejection reason and pending KYC"' -Cases @(0)),
        (New-ValueEntry -Text '"invalid rejection state"' -Cases @(1)),
        (New-ValueEntry -Text '"missing KYC record"' -Cases @(2))
    )))
    $models["Reject KYC"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns rejected KYC payload" -Cases @(0))
    )))
    $models["Reject KYC"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException for invalid rejection request" -Cases @(1)),
        (New-ValueEntry -Text "Returns NotFoundException when KYC record cannot be found" -Cases @(2))
    )))

    $models["Get User Detail"] = [ordered]@{
        name = "Get User Detail"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","N","A")
            status = @("P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","")
        }
    }
    $models["Get User Detail"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2,3,4)))
    $models["Get User Detail"].fields.Add((New-FieldSection -Name "user state" -Values @(
        (New-ValueEntry -Text '"existing user with KYC documents"' -Cases @(0,3)),
        (New-ValueEntry -Text '"existing user without KYC submission"' -Cases @(1)),
        (New-ValueEntry -Text '"missing user record"' -Cases @(2,4))
    )))
    $models["Get User Detail"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns detailed user payload with KYC data" -Cases @(0,3)),
        (New-ValueEntry -Text "Returns detailed user payload with NOT_STARTED KYC state" -Cases @(1))
    )))
    $models["Get User Detail"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns NotFoundException when user record does not exist" -Cases @(2,4))
    )))

    $models["Ban User"] = [ordered]@{
        name = "Ban User"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","A","A")
            status = @("P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","")
        }
    }
    $models["Ban User"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2,3,4)))
    $models["Ban User"].fields.Add((New-FieldSection -Name "ban request" -Values @(
        (New-ValueEntry -Text '"valid ban reason for active user"' -Cases @(0,1)),
        (New-ValueEntry -Text '"user already banned"' -Cases @(2,4)),
        (New-ValueEntry -Text '"missing user record"' -Cases @(3))
    )))
    $models["Ban User"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns banned user response" -Cases @(0,1))
    )))
    $models["Ban User"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException when user is already banned" -Cases @(2,4)),
        (New-ValueEntry -Text "Returns NotFoundException when user record cannot be found" -Cases @(3))
    )))

    $models["Unban User"] = [ordered]@{
        name = "Unban User"
        utcIds = @("UTCID01","UTCID02","UTCID03","UTCID04","UTCID05")
        preconditions = (New-Object 'System.Collections.Generic.List[object]')
        fields = (New-Object 'System.Collections.Generic.List[object]')
        confirmSections = (New-Object 'System.Collections.Generic.List[object]')
        footer = [ordered]@{
            types = @("N","N","A","A","A")
            status = @("P","P","P","P","P")
            dates = @("03-30","03-30","03-30","03-30","03-30")
            defects = @("","","","","")
        }
    }
    $models["Unban User"].preconditions.Add((New-ValueEntry -Text "Authenticated admin or staff user is available" -Cases @(0,1,2,3,4)))
    $models["Unban User"].fields.Add((New-FieldSection -Name "unban request" -Values @(
        (New-ValueEntry -Text '"valid unban reason for banned user"' -Cases @(0,1)),
        (New-ValueEntry -Text '"user is not banned"' -Cases @(2,4)),
        (New-ValueEntry -Text '"missing user record"' -Cases @(3))
    )))
    $models["Unban User"].confirmSections.Add((New-ConfirmSection -Name "Return" -Values @(
        (New-ValueEntry -Text "Returns unbanned user response" -Cases @(0,1))
    )))
    $models["Unban User"].confirmSections.Add((New-ConfirmSection -Name "Exception" -Values @(
        (New-ValueEntry -Text "Returns BadRequestException when user is not banned" -Cases @(2,4)),
        (New-ValueEntry -Text "Returns NotFoundException when user record cannot be found" -Cases @(3))
    )))

    return $models
}

function Get-CountedLineTotal {
    param(
        [string[]]$Paths,
        [hashtable]$Cache
    )

    $total = 0
    foreach ($path in ($Paths | Sort-Object -Unique)) {
        if (-not $path) {
            continue
        }
        if (-not $Cache.ContainsKey($path)) {
            $count = 0
            foreach ($line in (Get-Content -LiteralPath $path)) {
                $trimmed = $line.Trim()
                if ($trimmed -eq "") {
                    continue
                }
                if ($trimmed.StartsWith("//")) {
                    continue
                }
                $count++
            }
            $Cache[$path] = $count
        }
        $total += [int]$Cache[$path]
    }
    return $total
}

function Get-SheetHeaderData {
    param(
        [object]$Model,
        [hashtable]$Definitions,
        [hashtable]$AssertionLookup,
        [hashtable]$EndpointMap,
        [string]$OwnerName,
        [hashtable]$LineCountCache
    )

    $fullNames = @()
    if ($Definitions.Contains($Model.name)) {
        $fullNames = @($Definitions[$Model.name])
    }

    $suiteFiles = @()
    foreach ($fullName in $fullNames) {
        if ($AssertionLookup.ContainsKey($fullName)) {
            $suiteFiles += [string]$AssertionLookup[$fullName].suiteFile
        }
    }

    $passed = 0
    $failed = 0
    $untested = 0
    foreach ($status in $Model.footer.status) {
        switch ($status) {
            "P" { $passed++ }
            "F" { $failed++ }
            default { $untested++ }
        }
    }

    $nCount = 0
    $aCount = 0
    $bCount = 0
    foreach ($type in $Model.footer.types) {
        switch ($type) {
            "N" { $nCount++ }
            "A" { $aCount++ }
            "B" { $bCount++ }
        }
    }

    return [ordered]@{
        functionCode = $EndpointMap[$Model.name]
        functionName = $Model.name
        createdBy = $OwnerName
        executedBy = $OwnerName
        linesOfCode = (Get-CountedLineTotal -Paths $suiteFiles -Cache $LineCountCache)
        lackOfTestCases = 0
        passed = $passed
        failed = $failed
        untested = $untested
        nCount = $nCount
        aCount = $aCount
        bCount = $bCount
        totalTestCases = $Model.utcIds.Count
    }
}

function Get-JestLogSection {
    param(
        [object]$Model,
        [hashtable]$AssertionLookup,
        [hashtable]$Definitions
    )

    if (-not $Definitions.Contains($Model.name)) {
        return Get-GeneratedLogSection -Model $Model
    }

    $fullNames = $Definitions[$Model.name]
    if ($fullNames.Count -ne $Model.utcIds.Count) {
        throw "Sheet '$($Model.name)' expects $($Model.utcIds.Count) log rows but mapping has $($fullNames.Count)."
    }

    $logSection = [ordered]@{
        name = "Log message"
        values = New-Object 'System.Collections.Generic.List[object]'
    }

    for ($caseIndex = 0; $caseIndex -lt $fullNames.Count; $caseIndex++) {
        $fullName = $fullNames[$caseIndex]
        if (-not $AssertionLookup.ContainsKey($fullName)) {
            throw "Jest assertion not found for '$fullName'"
        }

        $title = [string]$AssertionLookup[$fullName].title
        $logSection.values.Add([ordered]@{
            text = '"' + $title + '"'
            cases = (New-CaseList -Index $caseIndex)
        })
    }

    return $logSection
}

function Get-GeneratedLogSection {
    param([object]$Model)

    $logSection = [ordered]@{
        name = "Log message"
        values = New-Object 'System.Collections.Generic.List[object]'
    }

    $exceptionSection = $null
    $returnSection = $null
    foreach ($section in $Model.confirmSections) {
        if ($section.name -eq "Exception") {
            $exceptionSection = $section
        }
        elseif ($section.name -eq "Return") {
            $returnSection = $section
        }
    }

    for ($caseIndex = 0; $caseIndex -lt $Model.utcIds.Count; $caseIndex++) {
        $type = ""
        if ($caseIndex -lt $Model.footer.types.Count) {
            $type = $Model.footer.types[$caseIndex]
        }
        if ($type -eq "" -or $type -eq "N") {
            continue
        }

        $message = $null

        if ($exceptionSection -ne $null) {
            foreach ($entry in $exceptionSection.values) {
                if (($entry.cases -contains $caseIndex) -and $entry.text -ne "No exception") {
                    $exceptionText = $entry.text
                    if ($exceptionText.StartsWith("Returns ")) {
                        $exceptionText = $exceptionText.Substring(8)
                    }
                    $message = "Expected $($Model.name) to return $exceptionText."
                    break
                }
            }
        }

        if (-not $message) {
            foreach ($field in $Model.fields) {
                $matchedValue = $null
                foreach ($value in $field.values) {
                    if ($value.cases -contains $caseIndex) {
                        $matchedValue = $value.text
                        break
                    }
                }
                if ($matchedValue) {
                    $message = "Expected $($Model.name) to handle $($field.name) = $matchedValue."
                    break
                }
            }
        }

        if (-not $message) {
            foreach ($precondition in $Model.preconditions) {
                if ($precondition.cases -contains $caseIndex) {
                    $message = "Expected $($Model.name) to behave correctly when $($precondition.text)."
                    break
                }
            }
        }

        if (-not $message -and $returnSection -ne $null) {
            foreach ($entry in $returnSection.values) {
                if ($entry.cases -contains $caseIndex) {
                    $returnText = $entry.text
                    if ($returnText.StartsWith("Returns ")) {
                        $returnText = $returnText.Substring(8)
                    }
                    $message = "Expected $($Model.name) to return $returnText."
                    break
                }
            }
        }

        if (-not $message) {
            $message = "Expected $($Model.name) case $($Model.utcIds[$caseIndex]) to behave as specified."
        }

        $logSection.values.Add([ordered]@{
            text = '"' + $message + '"'
            cases = (New-CaseList -Index $caseIndex)
        })
    }

    return $logSection
}

function Build-UnitSheetXml {
    param(
        [xml]$TemplateSheetXml,
        [hashtable]$RowTemplates,
        [object]$Model
    )

    [xml]$sheetXml = [xml]$TemplateSheetXml.OuterXml
    $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $ns.AddNamespace("x", $sheetXml.DocumentElement.NamespaceURI)

    $sheetData = $sheetXml.SelectSingleNode("//x:sheetData", $ns)
    foreach ($row in @($sheetXml.SelectNodes("//x:sheetData/x:row", $ns))) {
        [void]$sheetData.RemoveChild($row)
    }

    $mergeCells = $sheetXml.SelectSingleNode("//x:mergeCells", $ns)
    if ($mergeCells -ne $null) {
        foreach ($merge in @($mergeCells.SelectNodes("x:mergeCell", $ns))) {
            $ref = $merge.GetAttribute("ref")
            $parts = $ref.Split(":")
            $lastPart = $parts[-1]
            $rowNumber = [int]([regex]::Match($lastPart, '\d+')).Value
            if ($rowNumber -gt 7) {
                [void]$mergeCells.RemoveChild($merge)
            }
        }
    }

    for ($r = 1; $r -le 9; $r++) {
        $prototypeRow = $RowTemplates[$r]
        if ($null -eq $prototypeRow) {
            continue
        }
        $clonedRow = $sheetXml.ImportNode($prototypeRow, $true)
        [void]$sheetData.AppendChild($clonedRow)
    }

    $row2 = $sheetXml.SelectSingleNode("//x:sheetData/x:row[@r='2']", $ns)
    $row3 = $sheetXml.SelectSingleNode("//x:sheetData/x:row[@r='3']", $ns)
    $row4 = $sheetXml.SelectSingleNode("//x:sheetData/x:row[@r='4']", $ns)
    $row7 = $sheetXml.SelectSingleNode("//x:sheetData/x:row[@r='7']", $ns)

    Set-CellText -SheetXml $sheetXml -Row $row2 -NamespaceManager $ns -ColumnLetters "C" -Text ([string]$Model.header.functionCode) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row2 -NamespaceManager $ns -ColumnLetters "L" -Text ([string]$Model.header.functionName) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row3 -NamespaceManager $ns -ColumnLetters "C" -Text ([string]$Model.header.createdBy) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row3 -NamespaceManager $ns -ColumnLetters "L" -Text ([string]$Model.header.executedBy) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row4 -NamespaceManager $ns -ColumnLetters "C" -Text ([string]$Model.header.linesOfCode) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row4 -NamespaceManager $ns -ColumnLetters "L" -Text ([string]$Model.header.lackOfTestCases) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "A" -Text ([string]$Model.header.passed) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "C" -Text ([string]$Model.header.failed) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "F" -Text ([string]$Model.header.untested) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "L" -Text ([string]$Model.header.nCount) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "M" -Text ([string]$Model.header.aCount) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "N" -Text ([string]$Model.header.bCount) -StyleId ""
    Set-CellText -SheetXml $sheetXml -Row $row7 -NamespaceManager $ns -ColumnLetters "O" -Text ([string]$Model.header.totalTestCases) -StyleId ""

    $row9 = $sheetXml.SelectSingleNode("//x:sheetData/x:row[@r='9']", $ns)
    Clear-RowValues -Row $row9 -NamespaceManager $ns
    for ($i = 0; $i -lt $Model.utcIds.Count; $i++) {
        $column = Get-ColumnLettersFromIndex (6 + $i)
        Set-CellText -SheetXml $sheetXml -Row $row9 -NamespaceManager $ns -ColumnLetters $column -Text $Model.utcIds[$i] -StyleId "168"
    }

    $currentRow = 10

    $conditionHeaderRow = $sheetXml.ImportNode($RowTemplates["conditionHeader"], $true)
    $conditionHeaderRow.SetAttribute("r", [string]$currentRow)
    foreach ($cell in $conditionHeaderRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
    }
    Clear-RowValues -Row $conditionHeaderRow -NamespaceManager $ns
    Set-CellText -SheetXml $sheetXml -Row $conditionHeaderRow -NamespaceManager $ns -ColumnLetters "A" -Text "Condition" -StyleId "183"
    Set-CellText -SheetXml $sheetXml -Row $conditionHeaderRow -NamespaceManager $ns -ColumnLetters "B" -Text "Precondition" -StyleId "184"
    [void]$sheetData.AppendChild($conditionHeaderRow)
    $currentRow++

    foreach ($item in $Model.preconditions) {
        $row = $sheetXml.ImportNode($RowTemplates["value"], $true)
        $row.SetAttribute("r", [string]$currentRow)
        foreach ($cell in $row.SelectNodes("x:c", $ns)) {
            $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
        }
        Clear-RowValues -Row $row -NamespaceManager $ns
        Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters "D" -Text $item.text -StyleId "77"
        foreach ($caseIndex in $item.cases) {
            $column = Get-ColumnLettersFromIndex (6 + $caseIndex)
            Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters $column -Text "O" -StyleId "148"
        }
        [void]$sheetData.AppendChild($row)
        $currentRow++
    }

    foreach ($field in $Model.fields) {
        $headerRow = $sheetXml.ImportNode($RowTemplates["fieldHeader"], $true)
        $headerRow.SetAttribute("r", [string]$currentRow)
        foreach ($cell in $headerRow.SelectNodes("x:c", $ns)) {
            $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
        }
        Clear-RowValues -Row $headerRow -NamespaceManager $ns
        Set-CellText -SheetXml $sheetXml -Row $headerRow -NamespaceManager $ns -ColumnLetters "B" -Text $field.name -StyleId "75"
        [void]$sheetData.AppendChild($headerRow)
        $currentRow++

        foreach ($item in $field.values) {
            $row = $sheetXml.ImportNode($RowTemplates["value"], $true)
            $row.SetAttribute("r", [string]$currentRow)
            foreach ($cell in $row.SelectNodes("x:c", $ns)) {
                $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
            }
            Clear-RowValues -Row $row -NamespaceManager $ns
            Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters "D" -Text $item.text -StyleId "77"
            foreach ($caseIndex in $item.cases) {
                $column = Get-ColumnLettersFromIndex (6 + $caseIndex)
                Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters $column -Text "O" -StyleId "148"
            }
            [void]$sheetData.AppendChild($row)
            $currentRow++
        }
    }

    $firstConfirm = $true
    foreach ($section in $Model.confirmSections) {
        if ($section.name -eq "") {
            continue
        }

        $headerKey = "exceptionHeader"
        $headerStyle = "116"
        if ($firstConfirm) {
            $headerKey = "confirmHeader"
            $headerStyle = "208"
        }
        elseif ($section.name -eq "Log message") {
            $headerKey = "logHeader"
            $headerStyle = "88"
        }

        $headerRow = $sheetXml.ImportNode($RowTemplates[$headerKey], $true)
        $headerRow.SetAttribute("r", [string]$currentRow)
        foreach ($cell in $headerRow.SelectNodes("x:c", $ns)) {
            $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
        }
        Clear-RowValues -Row $headerRow -NamespaceManager $ns
        if ($firstConfirm) {
            Set-CellText -SheetXml $sheetXml -Row $headerRow -NamespaceManager $ns -ColumnLetters "A" -Text "Confirm" -StyleId "182"
        }
        Set-CellText -SheetXml $sheetXml -Row $headerRow -NamespaceManager $ns -ColumnLetters "B" -Text $section.name -StyleId $headerStyle
        [void]$sheetData.AppendChild($headerRow)
        $currentRow++

        $valueStyle = "90"
        if ($section.name -eq "Exception") {
            $valueStyle = "118"
        }

        foreach ($item in $section.values) {
            $prototypeKey = "confirmValue"
            if ($section.name -eq "Exception") {
                $prototypeKey = "exceptionValue"
            }
            elseif ($section.name -eq "Log message") {
                $prototypeKey = "logValue"
            }

            $row = $sheetXml.ImportNode($RowTemplates[$prototypeKey], $true)
            $row.SetAttribute("r", [string]$currentRow)
            foreach ($cell in $row.SelectNodes("x:c", $ns)) {
                $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
            }
            Clear-RowValues -Row $row -NamespaceManager $ns
            Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters "D" -Text $item.text -StyleId $valueStyle
            foreach ($caseIndex in $item.cases) {
                $column = Get-ColumnLettersFromIndex (6 + $caseIndex)
                Set-CellText -SheetXml $sheetXml -Row $row -NamespaceManager $ns -ColumnLetters $column -Text "O" -StyleId "148"
            }
            [void]$sheetData.AppendChild($row)
            $currentRow++
        }

        $firstConfirm = $false
    }

    $blankRow = $sheetXml.ImportNode($RowTemplates["blank"], $true)
    $blankRow.SetAttribute("r", [string]$currentRow)
    foreach ($cell in $blankRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $currentRow))
    }
    Clear-RowValues -Row $blankRow -NamespaceManager $ns
    [void]$sheetData.AppendChild($blankRow)
    $currentRow++

    $typeRowNumber = $currentRow
    $typeRow = $sheetXml.ImportNode($RowTemplates["resultType"], $true)
    $typeRow.SetAttribute("r", [string]$typeRowNumber)
    foreach ($cell in $typeRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $typeRowNumber))
    }
    Clear-RowValues -Row $typeRow -NamespaceManager $ns
    Set-CellText -SheetXml $sheetXml -Row $typeRow -NamespaceManager $ns -ColumnLetters "A" -Text "Result" -StyleId "182"
    Set-CellText -SheetXml $sheetXml -Row $typeRow -NamespaceManager $ns -ColumnLetters "B" -Text "Type(N : Normal, A : Abnormal, B : Boundary)" -StyleId "326"
    for ($i = 0; $i -lt $Model.footer.types.Count; $i++) {
        $column = Get-ColumnLettersFromIndex (6 + $i)
        if ($Model.footer.types[$i] -ne "") {
            Set-CellText -SheetXml $sheetXml -Row $typeRow -NamespaceManager $ns -ColumnLetters $column -Text $Model.footer.types[$i] -StyleId "188"
        }
    }
    [void]$sheetData.AppendChild($typeRow)
    $currentRow++

    $statusRowNumber = $currentRow
    $statusRow = $sheetXml.ImportNode($RowTemplates["resultStatus"], $true)
    $statusRow.SetAttribute("r", [string]$statusRowNumber)
    foreach ($cell in $statusRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $statusRowNumber))
    }
    Clear-RowValues -Row $statusRow -NamespaceManager $ns
    Set-CellText -SheetXml $sheetXml -Row $statusRow -NamespaceManager $ns -ColumnLetters "B" -Text "Passed/Failed" -StyleId "349"
    for ($i = 0; $i -lt $Model.footer.status.Count; $i++) {
        $column = Get-ColumnLettersFromIndex (6 + $i)
        if ($Model.footer.status[$i] -ne "") {
            Set-CellText -SheetXml $sheetXml -Row $statusRow -NamespaceManager $ns -ColumnLetters $column -Text $Model.footer.status[$i] -StyleId "94"
        }
    }
    [void]$sheetData.AppendChild($statusRow)
    $currentRow++

    $dateRowNumber = $currentRow
    $dateRow = $sheetXml.ImportNode($RowTemplates["resultDate"], $true)
    $dateRow.SetAttribute("r", [string]$dateRowNumber)
    foreach ($cell in $dateRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $dateRowNumber))
    }
    Clear-RowValues -Row $dateRow -NamespaceManager $ns
    Set-CellText -SheetXml $sheetXml -Row $dateRow -NamespaceManager $ns -ColumnLetters "B" -Text "Executed Date" -StyleId "324"
    for ($i = 0; $i -lt $Model.footer.dates.Count; $i++) {
        $column = Get-ColumnLettersFromIndex (6 + $i)
        if ($Model.footer.dates[$i] -ne "") {
            Set-CellText -SheetXml $sheetXml -Row $dateRow -NamespaceManager $ns -ColumnLetters $column -Text $Model.footer.dates[$i] -StyleId "97"
        }
    }
    [void]$sheetData.AppendChild($dateRow)
    $currentRow++

    $defectRowNumber = $currentRow
    $defectRow = $sheetXml.ImportNode($RowTemplates["resultDefect"], $true)
    $defectRow.SetAttribute("r", [string]$defectRowNumber)
    foreach ($cell in $defectRow.SelectNodes("x:c", $ns)) {
        $cell.SetAttribute("r", (Convert-CellReference -Reference $cell.GetAttribute("r") -NewRowNumber $defectRowNumber))
    }
    Clear-RowValues -Row $defectRow -NamespaceManager $ns
    Set-CellText -SheetXml $sheetXml -Row $defectRow -NamespaceManager $ns -ColumnLetters "B" -Text "Defect ID" -StyleId "325"
    for ($i = 0; $i -lt $Model.footer.defects.Count; $i++) {
        $column = Get-ColumnLettersFromIndex (6 + $i)
        if ($Model.footer.defects[$i] -ne "") {
            Set-CellText -SheetXml $sheetXml -Row $defectRow -NamespaceManager $ns -ColumnLetters $column -Text $Model.footer.defects[$i] -StyleId "90"
        }
    }
    [void]$sheetData.AppendChild($defectRow)
    $currentRow++

    if ($mergeCells -eq $null) {
        $mergeCells = $sheetXml.CreateElement("mergeCells", $sheetXml.DocumentElement.NamespaceURI)
        [void]$sheetXml.worksheet.AppendChild($mergeCells)
    }

    foreach ($mergeRef in @(
        ("B{0}:D{0}" -f $typeRowNumber),
        ("B{0}:D{0}" -f $statusRowNumber),
        ("B{0}:D{0}" -f $dateRowNumber),
        ("B{0}:D{0}" -f $defectRowNumber)
    )) {
        $mergeNode = $sheetXml.CreateElement("mergeCell", $sheetXml.DocumentElement.NamespaceURI)
        $mergeNode.SetAttribute("ref", $mergeRef)
        [void]$mergeCells.AppendChild($mergeNode)
    }
    $mergeCells.SetAttribute("count", [string]$mergeCells.SelectNodes("x:mergeCell", $ns).Count)

    $dimension = $sheetXml.SelectSingleNode("//x:dimension", $ns)
    if ($dimension -ne $null) {
        $dimension.SetAttribute("ref", ("A1:T{0}" -f ($currentRow - 1)))
    }

    return $sheetXml
}

$tempRoot = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets"
$workDir = Join-Path $tempRoot ("rebuild-layout-" + [guid]::NewGuid().ToString())
$templateCopyPath = Join-Path $workDir "template-copy.xlsx"
$sourceCopyPath = Join-Path $workDir "source-copy.xlsx"
$templateDir = Join-Path $workDir "template"
$sourceDir = Join-Path $workDir "source"
$zipPath = Join-Path $workDir "output.zip"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Copy-FileSharedRead -SourcePath $TemplatePath -DestinationPath $templateCopyPath
Copy-FileSharedRead -SourcePath $SourceCombinedPath -DestinationPath $sourceCopyPath

[System.IO.Compression.ZipFile]::ExtractToDirectory($templateCopyPath, $templateDir)
[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceCopyPath, $sourceDir)

[xml]$templateWorkbookXml = Read-XmlFile (Join-Path $templateDir "xl\workbook.xml")
[xml]$templateWorkbookRelsXml = Read-XmlFile (Join-Path $templateDir "xl\_rels\workbook.xml.rels")
[xml]$contentTypesXml = Read-XmlFile (Join-Path $templateDir "[Content_Types].xml")
[xml]$sourceWorkbookXml = Read-XmlFile (Join-Path $sourceDir "xl\workbook.xml")
[xml]$sourceWorkbookRelsXml = Read-XmlFile (Join-Path $sourceDir "xl\_rels\workbook.xml.rels")
[xml]$sourceSharedXml = Read-XmlFile (Join-Path $sourceDir "xl\sharedStrings.xml")

$templateNs = New-Object System.Xml.XmlNamespaceManager($templateWorkbookXml.NameTable)
$templateNs.AddNamespace("x", $templateWorkbookXml.DocumentElement.NamespaceURI)
$templateRelNs = New-Object System.Xml.XmlNamespaceManager($templateWorkbookRelsXml.NameTable)
$templateRelNs.AddNamespace("x", $templateWorkbookRelsXml.DocumentElement.NamespaceURI)
$sourceNs = New-Object System.Xml.XmlNamespaceManager($sourceWorkbookXml.NameTable)
$sourceNs.AddNamespace("x", $sourceWorkbookXml.DocumentElement.NamespaceURI)
$sourceRelNs = New-Object System.Xml.XmlNamespaceManager($sourceWorkbookRelsXml.NameTable)
$sourceRelNs.AddNamespace("x", $sourceWorkbookRelsXml.DocumentElement.NamespaceURI)
$contentTypesNs = New-Object System.Xml.XmlNamespaceManager($contentTypesXml.NameTable)
$contentTypesNs.AddNamespace("x", $contentTypesXml.DocumentElement.NamespaceURI)

$sourceSharedValues = @()
foreach ($si in $sourceSharedXml.sst.si) {
    $sourceSharedValues += (Get-SharedStringText $si)
}

$jestAssertionLookup = Get-JestAssertionLookup -Path $JestResultsPath
$sheetLogDefinitions = Get-SheetLogDefinitions
$sheetEndpointMap = Get-SheetEndpointMap
$lineCountCache = @{}
$supplementalSheetModels = Get-SupplementalSheetModels

$sourceModels = @{}
foreach ($sheetName in $unitSheetNames) {
    $sheetNode = $sourceWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='$sheetName']", $sourceNs)
    if ($sheetNode -ne $null) {
        $sheetRelId = $sheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
        $sheetRel = $sourceWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$sheetRelId']", $sourceRelNs)
        $sheetPath = Join-Path $sourceDir ("xl\" + $sheetRel.GetAttribute("Target").Replace('/', '\'))
        [xml]$sheetXml = Read-XmlFile $sheetPath
        $sourceModels[$sheetName] = Parse-SourceSheetModel -SheetXml $sheetXml -SharedValues $sourceSharedValues -SheetName $sheetName
    }
    elseif ($supplementalSheetModels.ContainsKey($sheetName)) {
        $sourceModels[$sheetName] = $supplementalSheetModels[$sheetName]
    }
    else {
        throw "Source model not found for sheet '$sheetName'"
    }

    $rebuiltConfirmSections = New-Object 'System.Collections.Generic.List[object]'
    foreach ($section in $sourceModels[$sheetName].confirmSections) {
        if ($section.name -ne "Log message") {
            $rebuiltConfirmSections.Add($section)
        }
    }
    $sourceModels[$sheetName].confirmSections = $rebuiltConfirmSections
    $sourceModels[$sheetName].confirmSections.Add(
        (Get-JestLogSection -Model $sourceModels[$sheetName] -AssertionLookup $jestAssertionLookup -Definitions $sheetLogDefinitions)
    )
    $sourceModels[$sheetName].header = Get-SheetHeaderData `
        -Model $sourceModels[$sheetName] `
        -Definitions $sheetLogDefinitions `
        -AssertionLookup $jestAssertionLookup `
        -EndpointMap $sheetEndpointMap `
        -OwnerName $ReportOwner `
        -LineCountCache $lineCountCache
}

$sampleSheetNode = $templateWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='Update Room']", $templateNs)
$sampleRelId = $sampleSheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
$sampleRel = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$sampleRelId']", $templateRelNs)
$sampleSheetPath = Join-Path $templateDir ("xl\" + $sampleRel.GetAttribute("Target").Replace('/', '\'))
[xml]$sampleSheetXml = Read-XmlFile $sampleSheetPath
$sampleSheetNs = New-Object System.Xml.XmlNamespaceManager($sampleSheetXml.NameTable)
$sampleSheetNs.AddNamespace("x", $sampleSheetXml.DocumentElement.NamespaceURI)

$rowTemplates = @{
    1 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='1']", $sampleSheetNs)
    2 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='2']", $sampleSheetNs)
    3 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='3']", $sampleSheetNs)
    4 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='4']", $sampleSheetNs)
    5 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='5']", $sampleSheetNs)
    6 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='6']", $sampleSheetNs)
    7 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='7']", $sampleSheetNs)
    8 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='8']", $sampleSheetNs)
    9 = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='9']", $sampleSheetNs)
    conditionHeader = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='10']", $sampleSheetNs)
    value = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='11']", $sampleSheetNs)
    fieldHeader = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='13']", $sampleSheetNs)
    confirmHeader = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='23']", $sampleSheetNs)
    confirmValue = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='25']", $sampleSheetNs)
    exceptionHeader = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='26']", $sampleSheetNs)
    exceptionValue = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='27']", $sampleSheetNs)
    logHeader = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='28']", $sampleSheetNs)
    logValue = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='29']", $sampleSheetNs)
    blank = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='34']", $sampleSheetNs)
    resultType = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='35']", $sampleSheetNs)
    resultStatus = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='36']", $sampleSheetNs)
    resultDate = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='37']", $sampleSheetNs)
    resultDefect = $sampleSheetXml.SelectSingleNode("//x:sheetData/x:row[@r='38']", $sampleSheetNs)
}

$templateSheets = @($templateWorkbookXml.SelectNodes("//x:sheets/x:sheet", $templateNs))
$repurposedSheets = $templateSheets[4..12]

for ($i = 0; $i -lt 9; $i++) {
    $repurposedSheets[$i].SetAttribute("name", $unitSheetNames[$i])
}

$relationshipsRoot = $templateWorkbookRelsXml.DocumentElement
$maxSheetId = 0
foreach ($sheet in $templateSheets) {
    $sheetId = [int]$sheet.GetAttribute("sheetId")
    if ($sheetId -gt $maxSheetId) {
        $maxSheetId = $sheetId
    }
}

$maxRelIdNumber = 0
foreach ($relationship in $templateWorkbookRelsXml.SelectNodes("/x:Relationships/x:Relationship", $templateRelNs)) {
    if ($relationship.GetAttribute("Id") -match '^rId(\d+)$') {
        $number = [int]$matches[1]
        if ($number -gt $maxRelIdNumber) {
            $maxRelIdNumber = $number
        }
    }
}

$sheetPrototype = $templateSheets[4]
$relationshipPrototype = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[contains(@Type,'/worksheet')][1]", $templateRelNs)
$newSheetNumbers = @()

for ($i = 9; $i -lt $unitSheetNames.Count; $i++) {
    $maxSheetId++
    $maxRelIdNumber++
    $sheetNumber = 14 + ($i - 9)
    $newSheetNumbers += $sheetNumber
    $relationshipId = "rId$maxRelIdNumber"

    $newRelationship = $templateWorkbookRelsXml.ImportNode($relationshipPrototype, $true)
    $newRelationship.SetAttribute("Id", $relationshipId)
    $newRelationship.SetAttribute("Target", "worksheets/sheet$sheetNumber.xml")
    [void]$relationshipsRoot.AppendChild($newRelationship)

    $newSheet = $templateWorkbookXml.ImportNode($sheetPrototype, $true)
    $newSheet.SetAttribute("name", $unitSheetNames[$i])
    $newSheet.SetAttribute("sheetId", [string]$maxSheetId)
    $newSheet.SetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships", $relationshipId)
    if ($newSheet.HasAttribute("state")) {
        $newSheet.RemoveAttribute("state")
    }
    [void]$templateWorkbookXml.SelectSingleNode("//x:sheets", $templateNs).AppendChild($newSheet)
}

foreach ($unitSheetName in $unitSheetNames) {
    $sheetNode = $templateWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='$unitSheetName']", $templateNs)
    $sheetRelId = $sheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $sheetRel = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$sheetRelId']", $templateRelNs)
    $sheetTarget = $sheetRel.GetAttribute("Target").Replace('/', '\')
    $sheetFileName = [System.IO.Path]::GetFileName($sheetTarget)
    $sheetPath = Join-Path $templateDir ("xl\worksheets\" + $sheetFileName)
    $rebuiltSheet = Build-UnitSheetXml -TemplateSheetXml $sampleSheetXml -RowTemplates $rowTemplates -Model $sourceModels[$unitSheetName]
    $rebuiltSheet.Save($sheetPath)

    $sheetRelsPath = Join-Path $templateDir ("xl\worksheets\_rels\" + $sheetFileName + ".rels")
    if (Test-Path -LiteralPath $sheetRelsPath) {
        Remove-Item -LiteralPath $sheetRelsPath -Force
    }
}

$testReportSheetNode = $templateWorkbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='Test Report']", $templateNs)
if ($testReportSheetNode -ne $null) {
    $testReportRelId = $testReportSheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $testReportRel = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[@Id='$testReportRelId']", $templateRelNs)
    if ($testReportRel -ne $null) {
        $testReportPath = Join-Path $templateDir ("xl\" + $testReportRel.GetAttribute("Target").Replace('/', '\'))
        [xml]$testReportXml = Read-XmlFile $testReportPath
        Update-TestReportSheetXml -SheetXml $testReportXml -UnitSheetNames $unitSheetNames -SourceModels $sourceModels -ReportOwner $ReportOwner
        $testReportXml.Save($testReportPath)
    }
}

foreach ($sheetNumber in $newSheetNumbers) {
    $existingOverride = $contentTypesXml.SelectSingleNode("//x:Override[@PartName='/xl/worksheets/sheet$sheetNumber.xml']", $contentTypesNs)
    if ($null -eq $existingOverride) {
        $override = $contentTypesXml.CreateElement("Override", $contentTypesXml.DocumentElement.NamespaceURI)
        $override.SetAttribute("PartName", "/xl/worksheets/sheet$sheetNumber.xml")
        $override.SetAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml")
        [void]$contentTypesXml.Types.AppendChild($override)
    }
}

$calcChainRel = $templateWorkbookRelsXml.SelectSingleNode("/x:Relationships/x:Relationship[contains(@Type,'/calcChain')]", $templateRelNs)
if ($calcChainRel -ne $null) {
    [void]$relationshipsRoot.RemoveChild($calcChainRel)
}
$calcChainPath = Join-Path $templateDir "xl\calcChain.xml"
if (Test-Path -LiteralPath $calcChainPath) {
    Remove-Item -LiteralPath $calcChainPath -Force
}
$calcChainOverride = $contentTypesXml.SelectSingleNode("//x:Override[@PartName='/xl/calcChain.xml']", $contentTypesNs)
if ($calcChainOverride -ne $null) {
    [void]$contentTypesXml.Types.RemoveChild($calcChainOverride)
}

$templateWorkbookXml.Save((Join-Path $templateDir "xl\workbook.xml"))
$templateWorkbookRelsXml.Save((Join-Path $templateDir "xl\_rels\workbook.xml.rels"))
$contentTypesXml.Save((Join-Path $templateDir "[Content_Types].xml"))

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
if (Test-Path -LiteralPath $OutputWorkbookPath) {
    Remove-Item -LiteralPath $OutputWorkbookPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($templateDir, $zipPath)
Move-Item -LiteralPath $zipPath -Destination $OutputWorkbookPath -Force

Remove-Item -LiteralPath $workDir -Recurse -Force

Write-Output "Generated workbook: $OutputWorkbookPath"
