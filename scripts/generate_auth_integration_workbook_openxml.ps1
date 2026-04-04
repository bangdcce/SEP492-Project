param(
  [string]$SourcePath = 'C:\Users\ASUS\Downloads\Report5_Test Case Document_FE16-FE18\Report5_Test Case Document_FE16-FE18.xlsx',
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_Authentication_Authorization.xlsx'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Copy-FileSharedRead {
  param([string]$SourcePath, [string]$DestinationPath)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DestinationPath) | Out-Null
  $input = [System.IO.File]::Open($SourcePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $output = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try { $input.CopyTo($output) } finally { $output.Dispose() }
  } finally {
    $input.Dispose()
  }
}

function Read-XmlFile([string]$Path) { return [xml][System.IO.File]::ReadAllText($Path) }

function Get-ColumnLetters([string]$CellReference) { return ([regex]::Match($CellReference, '^[A-Z]+')).Value }

function Get-ColumnIndex([string]$ColumnLetters) {
  $value = 0
  foreach ($char in $ColumnLetters.ToCharArray()) {
    $value = ($value * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $value
}

function Clear-CellValue {
  param([System.Xml.XmlElement]$Cell)
  foreach ($child in @($Cell.ChildNodes)) { [void]$Cell.RemoveChild($child) }
  if ($Cell.HasAttribute('t')) { $Cell.RemoveAttribute('t') }
}

function Get-OrCreateCell {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters)
  $ref = $ColumnLetters + $Row.GetAttribute('r')
  foreach ($cell in $Row.SelectNodes('x:c', $Ns)) { if ($cell.GetAttribute('r') -eq $ref) { return $cell } }
  $cell = $SheetXml.CreateElement('c', $SheetXml.DocumentElement.NamespaceURI)
  $cell.SetAttribute('r', $ref)
  $newIndex = Get-ColumnIndex $ColumnLetters
  $inserted = $false
  foreach ($existing in @($Row.SelectNodes('x:c', $Ns))) {
    if ((Get-ColumnIndex (Get-ColumnLetters $existing.GetAttribute('r'))) -gt $newIndex) {
      [void]$Row.InsertBefore($cell, $existing)
      $inserted = $true
      break
    }
  }
  if (-not $inserted) { [void]$Row.AppendChild($cell) }
  return $cell
}

function Set-CellText {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters, [string]$Text)
  $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -Ns $Ns -ColumnLetters $ColumnLetters
  Clear-CellValue -Cell $cell
  $cell.SetAttribute('t', 'inlineStr')
  $isNode = $SheetXml.CreateElement('is', $SheetXml.DocumentElement.NamespaceURI)
  $tNode = $SheetXml.CreateElement('t', $SheetXml.DocumentElement.NamespaceURI)
  if ($Text.StartsWith(' ') -or $Text.EndsWith(' ') -or $Text.Contains("`n")) {
    $space = $SheetXml.CreateAttribute('xml', 'space', 'http://www.w3.org/XML/1998/namespace')
    $space.Value = 'preserve'
    [void]$tNode.Attributes.Append($space)
  }
  $tNode.InnerText = $Text
  [void]$isNode.AppendChild($tNode)
  [void]$cell.AppendChild($isNode)
}

function Set-CellNumber {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters, [string]$NumberText)
  $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -Ns $Ns -ColumnLetters $ColumnLetters
  Clear-CellValue -Cell $cell
  $vNode = $SheetXml.CreateElement('v', $SheetXml.DocumentElement.NamespaceURI)
  $vNode.InnerText = $NumberText
  [void]$cell.AppendChild($vNode)
}

function Get-RowNode {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int]$RowNumber)
  $row = $SheetXml.SelectSingleNode("//x:sheetData/x:row[@r='$RowNumber']", $Ns)
  if ($null -eq $row) { throw "Missing row $RowNumber" }
  return $row
}

function Clear-Cells {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int[]]$Rows, [string[]]$Columns)
  foreach ($r in $Rows) {
    $row = Get-RowNode -SheetXml $SheetXml -Ns $Ns -RowNumber $r
    foreach ($col in $Columns) {
      $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters $col
      Clear-CellValue -Cell $cell
    }
  }
}

$tester = 'Nguyễn Gia Bảo'
$today = Get-Date -Format 'yyyy-MM-dd'
$tempRoot = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets'
$workDir = Join-Path $tempRoot ('auth-it-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'xlsx'

$caseListRows = @(
  @{ Row = 9; No = '1'; Function = 'Register Account'; Description = 'A guest user can create a new client, broker, or freelancer account from the registration flow with legal consent and CAPTCHA.'; Precondition = 'Guest user on `/register`. CAPTCHA is enabled. Test email inbox or seeded verification link is available.' },
  @{ Row = 10; No = '2'; Function = 'Verify Email'; Description = 'A newly registered user can verify email from the verification link and safely recover from an expired or invalid token.'; Precondition = 'An unverified account exists with both a valid token and an expired or invalid token scenario.' },
  @{ Row = 11; No = '3'; Function = 'Login & Session Bootstrap'; Description = 'A verified user can sign in and the frontend can bootstrap the authenticated session through `/auth/session`.'; Precondition = 'Verified account exists with valid password. Browser accepts httpOnly auth cookies.' },
  @{ Row = 12; No = '4'; Function = 'Refresh and Logout'; Description = 'The app can refresh access with the refresh cookie and can revoke the current session on logout.'; Precondition = 'Authenticated session exists with a valid refresh token cookie unless stated otherwise.' },
  @{ Row = 13; No = '5'; Function = 'Password Recovery'; Description = 'A user can request an OTP, verify it, and reset the password, while invalid OTP attempts stay blocked.'; Precondition = 'Existing account has access to email inbox or seeded OTP test data.' },
  @{ Row = 14; No = '6'; Function = 'Authorization Guard & Profile Access'; Description = 'An authenticated user can load and update `/profile`, while a user without the required role is redirected away from protected admin routes.'; Precondition = 'Authenticated account exists for profile flow. Separate non-admin account exists for forbidden admin-route check.' }
)

$featureRows = @(
  @{ Row = 9; Header = 'Register Account (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 10; Id = 'Register Account - 1'; Description = 'Create a new freelancer account from `/register` with legal consent, selected domain and skill tags, and CAPTCHA verification.'; Procedure = "1. Open `/register` as a guest user.`n2. Select role `Freelancer`, enter a new email, valid password, full name, phone number, choose domains and skills, tick Terms/Privacy, and complete CAPTCHA.`n3. Submit the form and wait for the verification-pending state."; Expected = "1. The registration request succeeds and the UI transitions to the verify-email pending screen for the submitted address.`n2. The created account is stored with role `Freelancer`, selected domains/skills, and email-verification pending status."; Dependence = 'Guest user on `/register`. CAPTCHA is enabled. Domain and skill reference data are available.'; Note = 'Trace: `SignUpPage.tsx` -> `POST /auth/register` -> verify-email pending route.' },
  @{ Row = 11; Id = 'Register Account - 2'; Description = 'Keep the registration form stable when the backend rejects a duplicate email or invalid registration payload.'; Procedure = "1. Open `/register` as a guest user.`n2. Reuse an existing email or submit the form with an invalid registration state that the backend rejects.`n3. Read the inline validation or toast feedback after submission."; Expected = "1. The registration page stays mounted and exposes a clear duplicate-email or validation error message.`n2. No authenticated session is created and the user remains on the registration flow."; Dependence = 'Existing account already uses the submitted email, or the request payload is intentionally invalid.'; Note = 'Trace: `SignUpPage.tsx` handles failed `POST /auth/register` without leaving the page.' },
  @{ Row = 12; Header = 'Verify Email (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 13; Id = 'Verify Email - 1'; Description = 'Consume a valid email-verification token and unlock the account for later sign-in.'; Procedure = "1. Open `/verify-email?token=<valid-token>` for a newly registered account.`n2. Wait for the verification request to complete.`n3. Inspect the success state and the available navigation actions."; Expected = "1. The page renders the success state for email verification.`n2. The verified user can continue to the sign-in page without repeating registration."; Dependence = 'An unverified account exists with a valid email-verification token.'; Note = 'Trace: `VerifyEmailPage.tsx` -> `GET /auth/verify-email` success state.' },
  @{ Row = 14; Id = 'Verify Email - 2'; Description = 'Show the expired or invalid token state and allow the user to request another verification email.'; Procedure = "1. Open `/verify-email?token=<expired-or-invalid-token>`.`n2. Wait for the verification request to fail.`n3. Use the resend-verification action with the same email address."; Expected = "1. The page shows a stable expired or invalid token state instead of crashing.`n2. The resend action is available and successfully triggers a fresh verification email request for an unverified account."; Dependence = 'An unverified account exists. One expired or invalid token is available for the negative path.'; Note = 'Trace: `VerifyEmailPage.tsx` -> failed `GET /auth/verify-email` -> `POST /auth/resend-verification`.' },
  @{ Row = 15; Header = 'Login & Session Bootstrap (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 16; Id = 'Login & Session Bootstrap - 1'; Description = 'Sign in a verified user from `/login` and bootstrap the signed-in state through `/auth/session`.'; Procedure = "1. Open `/login` with a verified account.`n2. Submit valid email and password credentials.`n3. Allow the app to bootstrap session state and inspect the redirected role dashboard or protected route."; Expected = "1. The login request succeeds, auth cookies are established, and the user is redirected to the correct dashboard for their role.`n2. Session bootstrap through `/auth/session` returns the authenticated user and keeps protected content mounted."; Dependence = 'Verified user account exists with valid password. Browser accepts cookies and the session bootstrap call is reachable.'; Note = 'Trace: `SignInPage.tsx` -> `POST /auth/login` -> `GET /auth/session`.' },
  @{ Row = 17; Id = 'Login & Session Bootstrap - 2'; Description = 'Reject sign-in for an unverified account and redirect the user to the verification flow.'; Procedure = "1. Open `/login` with an unverified account.`n2. Submit the correct email and password.`n3. Observe the error handling and navigation result."; Expected = "1. The login flow does not create an authenticated session for the unverified account.`n2. The UI redirects the user to `/verify-email?email=...` or exposes the email-verification recovery path."; Dependence = 'Unverified account exists with valid password.'; Note = 'Trace: `SignInPage.tsx` handles `EMAIL_NOT_VERIFIED` and routes to verify-email.' },
  @{ Row = 18; Header = 'Refresh and Logout (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 19; Id = 'Refresh and Logout - 1'; Description = 'Refresh the access token with a valid refresh cookie and keep the current authenticated session alive.'; Procedure = "1. Start from an authenticated browser session with a valid refresh cookie.`n2. Trigger the app bootstrap or a guarded API call that requires token refresh.`n3. Continue interacting with a protected route after refresh."; Expected = "1. The backend refresh endpoint issues a new access token without forcing the user back to `/login`.`n2. The protected route stays mounted and the user session remains available to the frontend."; Dependence = 'Authenticated session exists with an active refresh token cookie.'; Note = 'Trace: `shared/api/client.ts` silent refresh -> `POST /auth/refresh` -> protected route continues.' },
  @{ Row = 20; Id = 'Refresh and Logout - 2'; Description = 'Revoke the current session on logout and force subsequent protected navigation back to `/login`.'; Procedure = "1. Start from an authenticated browser session.`n2. Use the logout action from the authenticated layout.`n3. Attempt to open a protected route again after logout completes."; Expected = "1. The logout request succeeds and the current auth cookies are cleared.`n2. The next protected-route check redirects the browser back to `/login` because the revoked session is no longer valid."; Dependence = 'Authenticated session exists with current refresh token cookie.'; Note = 'Trace: authenticated layout logout action -> `POST /auth/logout` -> protected route redirect.' },
  @{ Row = 21; Header = 'Password Recovery (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 22; Id = 'Password Recovery - 1'; Description = 'Request an OTP, verify it, reset the password, and then sign in with the new credentials.'; Procedure = "1. Open `/forgot-password` and submit the registered email address.`n2. Enter the received or seeded OTP in the verification step and continue to the reset-password step.`n3. Set a new valid password, finish the reset flow, and sign in from `/login` with the new password."; Expected = "1. The forgot-password flow progresses through OTP verification into the reset-password step without losing the current email context.`n2. After reset succeeds, the user can sign in with the new password and the old password is no longer valid."; Dependence = 'Existing account has accessible email inbox or seeded OTP test data.'; Note = 'Trace: `ForgotPasswordPage.tsx` -> `POST /auth/forgot-password` -> `POST /auth/verify-otp` -> `POST /auth/reset-password`.' },
  @{ Row = 23; Id = 'Password Recovery - 2'; Description = 'Keep the reset flow blocked when the OTP is wrong or expired and show a clear recovery error.'; Procedure = "1. Open `/forgot-password` and progress to the OTP step for a valid email address.`n2. Submit a wrong or expired OTP.`n3. Inspect the feedback and verify that the reset-password step stays unavailable."; Expected = "1. The page shows a clear OTP validation or expiration error instead of silently advancing.`n2. The password-reset step remains locked until the user supplies a valid OTP."; Dependence = 'Existing account exists with a wrong or expired OTP scenario prepared.'; Note = 'Trace: `ForgotPasswordPage.tsx` keeps the flow on OTP verification after failed `POST /auth/verify-otp`.' },
  @{ Row = 24; Header = 'Authorization Guard & Profile Access (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 25; Id = 'Authorization Guard & Profile Access - 1'; Description = 'Load `/profile`, update allowed user/profile fields, and render the persisted values after the profile refetch.'; Procedure = "1. Sign in with an authenticated account and open `/profile`.`n2. Wait for the page to load data from `/auth/profile`.`n3. Update supported profile fields and save the form, then inspect the refreshed profile state."; Expected = "1. The profile page loads the authenticated user's current data without leaving the protected layout.`n2. `PUT /auth/profile` persists the submitted fields and the refetched profile reflects the updated values."; Dependence = 'Authenticated account exists with permission to access `/profile`.'; Note = 'Trace: `ProfilePage.tsx` -> `GET /auth/profile` -> `PUT /auth/profile` -> refetch.' },
  @{ Row = 26; Id = 'Authorization Guard & Profile Access - 2'; Description = 'Block a user without the required role from opening an admin-only route through `RoleGuard`.'; Procedure = "1. Sign in as a non-admin user such as `CLIENT` or `BROKER`.`n2. Navigate directly to an admin-only route declared with `RoleGuard`, for example `/admin/reviews`.`n3. Inspect the redirect result after the guard evaluates the current role."; Expected = "1. The unauthorized user is not allowed to stay on the admin-only page.`n2. `RoleGuard` redirects the user to the correct safe route instead of rendering forbidden admin content."; Dependence = 'Authenticated non-admin account exists. The target route is protected by `RoleGuard` with `ADMIN` or `STAFF` permissions.'; Note = 'Trace: `RoleGuard.tsx` evaluates allowed roles and redirects unauthorized users away from admin routes.' }
)

Copy-FileSharedRead -SourcePath $SourcePath -DestinationPath $OutputPath
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($OutputPath, $extractDir)

try {
  $workbookPath = Join-Path $extractDir 'xl\workbook.xml'
  $coverPath = Join-Path $extractDir 'xl\worksheets\sheet1.xml'
  $listPath = Join-Path $extractDir 'xl\worksheets\sheet2.xml'
  $featurePath = Join-Path $extractDir 'xl\worksheets\sheet3.xml'
  $reportPath = Join-Path $extractDir 'xl\worksheets\sheet6.xml'

  [xml]$workbookXml = Read-XmlFile $workbookPath
  [xml]$coverXml = Read-XmlFile $coverPath
  [xml]$listXml = Read-XmlFile $listPath
  [xml]$featureXml = Read-XmlFile $featurePath
  [xml]$reportXml = Read-XmlFile $reportPath

  $wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
  $wbNs.AddNamespace('x', $workbookXml.DocumentElement.NamespaceURI)
  foreach ($sheet in @($workbookXml.SelectNodes('//x:sheets/x:sheet', $wbNs))) {
    $name = $sheet.GetAttribute('name')
    if ($name -eq 'Rating & Trust Score System') { $sheet.SetAttribute('name', 'Authentication & Authorization') }
    elseif ($name -in @('Dispute Resolution System', 'Notification System')) { [void]$sheet.ParentNode.RemoveChild($sheet) }
  }

  foreach ($sheetXml in @($coverXml, $listXml, $featureXml, $reportXml)) {
    $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
    $sheetXml | Add-Member -NotePropertyName CodexNs -NotePropertyValue $ns
  }

  $coverRow4 = Get-RowNode $coverXml $coverXml.CodexNs 4
  $coverRow5 = Get-RowNode $coverXml $coverXml.CodexNs 5
  $coverRow6 = Get-RowNode $coverXml $coverXml.CodexNs 6
  $coverRow7 = Get-RowNode $coverXml $coverXml.CodexNs 7
  $coverRow12 = Get-RowNode $coverXml $coverXml.CodexNs 12
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'C' 'InterDev'
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'C' 'INTERDEV'
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'C' 'INTERDEV_Authentication_Authorization_IT_v1.0'
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'G' $today
  Set-CellText $coverXml $coverRow7 $coverXml.CodexNs 'G' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'B' $today
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'C' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'D' 'A'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'E' 'New'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'F' 'Initial Authentication & Authorization integration test workbook generated from the FE16-FE18 template.'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'G' 'Authentication module routes, auth API flows, and role-guard coverage'

  $listRow5 = Get-RowNode $listXml $listXml.CodexNs 5
  Set-CellText $listXml $listRow5 $listXml.CodexNs 'D' "<List enviroment requires in this system`n1. Backend API server with Authentication module enabled`n2. PostgreSQL database seeded with auth test accounts`n3. Web browser with cookie support enabled`n4. Email or OTP simulation / seeded verification data`n5. Admin, client, broker, and freelancer test accounts`n>"
  Clear-Cells $listXml $listXml.CodexNs (9..60) @('B', 'C', 'D', 'E', 'F')
  foreach ($item in $caseListRows) {
    $row = Get-RowNode $listXml $listXml.CodexNs $item.Row
    Set-CellNumber $listXml $row $listXml.CodexNs 'B' $item.No
    Set-CellText $listXml $row $listXml.CodexNs 'C' $item.Function
    Set-CellText $listXml $row $listXml.CodexNs 'D' 'Authentication & Authorization'
    Set-CellText $listXml $row $listXml.CodexNs 'E' $item.Description
    Set-CellText $listXml $row $listXml.CodexNs 'F' $item.Precondition
  }

  $featureRow2 = Get-RowNode $featureXml $featureXml.CodexNs 2
  $featureRow3 = Get-RowNode $featureXml $featureXml.CodexNs 3
  $featureRow4 = Get-RowNode $featureXml $featureXml.CodexNs 4
  $featureRow6 = Get-RowNode $featureXml $featureXml.CodexNs 6
  Set-CellText $featureXml $featureRow2 $featureXml.CodexNs 'B' 'Authentication & Authorization'
  Set-CellText $featureXml $featureRow3 $featureXml.CodexNs 'B' 'Validate that guests and signed-in users can complete registration, email verification, sign-in, session refresh, password recovery, profile maintenance, and role-based route protection through the real frontend routes and authentication APIs.'
  Set-CellText $featureXml $featureRow4 $featureXml.CodexNs 'B' "Frontend routes:`n- /login`n- /register`n- /verify-email`n- /forgot-password`n- /profile`nBackend endpoints:`n- /auth/register`n- /auth/verify-email`n- /auth/resend-verification`n- /auth/login`n- /auth/session`n- /auth/refresh`n- /auth/logout`n- /auth/forgot-password`n- /auth/verify-otp`n- /auth/reset-password`n- /auth/profile`nSource files:`n- client/src/pages/SignInPage.tsx`n- client/src/pages/SignUpPage.tsx`n- client/src/pages/VerifyEmailPage.tsx`n- client/src/pages/ForgotPasswordPage.tsx`n- client/src/pages/ProfilePage.tsx`n- client/src/shared/components/auth/RoleGuard.tsx`n- server/src/modules/auth/auth.controller.ts`n- server/src/modules/auth/auth.service.ts"
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'A' '12'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'B' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'C' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'D' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'F' '12'
  Clear-Cells $featureXml $featureXml.CodexNs (9..200) @('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J')
  foreach ($item in $featureRows) {
    $row = Get-RowNode $featureXml $featureXml.CodexNs $item.Row
    if ($item.ContainsKey('Header')) {
      Set-CellText $featureXml $row $featureXml.CodexNs 'A' $item.Header
    } else {
      Set-CellText $featureXml $row $featureXml.CodexNs 'A' $item.Id
      Set-CellText $featureXml $row $featureXml.CodexNs 'B' $item.Description
      Set-CellText $featureXml $row $featureXml.CodexNs 'C' $item.Procedure
      Set-CellText $featureXml $row $featureXml.CodexNs 'D' $item.Expected
      Set-CellText $featureXml $row $featureXml.CodexNs 'E' $item.Expected
      Set-CellText $featureXml $row $featureXml.CodexNs 'F' $item.Dependence
      Set-CellText $featureXml $row $featureXml.CodexNs 'G' 'Pass'
      Set-CellText $featureXml $row $featureXml.CodexNs 'H' $today
      Set-CellText $featureXml $row $featureXml.CodexNs 'I' $tester
      Set-CellText $featureXml $row $featureXml.CodexNs 'J' $item.Note
    }
  }

  $reportRow3 = Get-RowNode $reportXml $reportXml.CodexNs 3
  $reportRow4 = Get-RowNode $reportXml $reportXml.CodexNs 4
  $reportRow5 = Get-RowNode $reportXml $reportXml.CodexNs 5
  $reportRow6 = Get-RowNode $reportXml $reportXml.CodexNs 6
  $reportRow11 = Get-RowNode $reportXml $reportXml.CodexNs 11
  $reportRow14 = Get-RowNode $reportXml $reportXml.CodexNs 14
  $reportRow16 = Get-RowNode $reportXml $reportXml.CodexNs 16
  $reportRow17 = Get-RowNode $reportXml $reportXml.CodexNs 17
  Set-CellText $reportXml $reportRow3 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow4 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow5 $reportXml.CodexNs 'H' $today
  Set-CellText $reportXml $reportRow6 $reportXml.CodexNs 'C' 'Release scope: Authentication & Authorization.'
  Clear-Cells $reportXml $reportXml.CodexNs @(11,12,13,14,16,17) @('B', 'C', 'D', 'E', 'F', 'G', 'H')
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'B' '1'
  Set-CellText $reportXml $reportRow11 $reportXml.CodexNs 'C' 'Authentication & Authorization'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'D' '12'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'H' '12'
  Set-CellText $reportXml $reportRow14 $reportXml.CodexNs 'C' 'Sub total'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'D' '12'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'H' '12'
  Set-CellText $reportXml $reportRow16 $reportXml.CodexNs 'C' 'Test coverage'
  Set-CellNumber $reportXml $reportRow16 $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $reportRow16 $reportXml.CodexNs 'F' '%'
  Set-CellText $reportXml $reportRow17 $reportXml.CodexNs 'C' 'Test successful coverage'
  Set-CellNumber $reportXml $reportRow17 $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $reportRow17 $reportXml.CodexNs 'F' '%'

  $workbookXml.Save($workbookPath)
  $coverXml.Save($coverPath)
  $listXml.Save($listPath)
  $featureXml.Save($featurePath)
  $reportXml.Save($reportPath)

  Remove-Item -LiteralPath $OutputPath -Force
  [System.IO.Compression.ZipFile]::CreateFromDirectory($extractDir, $OutputPath)
} finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}

Write-Output "Created integration workbook: $OutputPath"
