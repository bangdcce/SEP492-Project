const fs = require('fs');
const file = 'd:/GradProject/SEP492-Project/client/src/features/requests/RequestDetailPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// conflict 1
content = content.replace(
/<<<<<<< HEAD\r?\nimport { ArrowLeft, Check, FileText, UserPlus, HelpCircle, Info, Users, Star, AlertTriangle, Sparkles, Loader2, Trash2 } from "lucide-react";\r?\n=======\r?\nimport { ArrowLeft, AlertTriangle, Check, FileText, HelpCircle, UserPlus, Users } from "lucide-react";\r?\n>>>>>>> a13656348293bc67793a6e682dd221fbf8c1eb32/g,
'import { ArrowLeft, AlertTriangle, Check, FileText, HelpCircle, Info, Loader2, Sparkles, Star, Trash2, UserPlus, Users } from "lucide-react";'
);

// conflict 2
content = content.replace(
/<<<<<<< HEAD\r?\n\s*const updatedRequest = newStatus === RequestStatus\.PUBLIC_DRAFT[\s\S]*?setRequest\(\(prev: any\) => \(\{ \.\.\.prev, \.\.\.\(updatedRequest \|\| \{\}\), status: updatedRequest\?\.status \|\| newStatus \}\)\);\r?\n=======\r?\n\s*await wizardService\.updateRequest\(id!, \{ status: newStatus \}\);\r?\n\s*setRequest\(\(prev\) => \(prev \? \{ \.\.\.prev, status: newStatus \} : prev\)\);\r?\n>>>>>>> a13656348293bc67793a6e682dd221fbf8c1eb32/g,
`          const updatedRequest = newStatus === RequestStatus.PUBLIC_DRAFT
            ? await wizardService.publishRequest(id!)
            : await wizardService.updateRequest(id!, { status: newStatus });
          setRequest((prev: any) => ({ ...prev, ...(updatedRequest || {}), status: updatedRequest?.status || newStatus }));`
);

// conflict 3
content = content.replace(
/<<<<<<< HEAD\r?\n\s*const handleHireBrokerClick =[\s\S]*?setShowDeleteConfirm\(false\);\r?\n=======\r?\n\s*const handleReleaseBrokerSlot =[\s\S]*?toast\.error\(getApiErrorDetails\(error, "Failed to release broker slot\."\)\.message\);\r?\n>>>>>>> a13656348293bc67793a6e682dd221fbf8c1eb32/g,
`  const handleHireBrokerClick = (brokerId: string) => {
      setPendingHireBrokerId(brokerId);
      setShowHireBrokerWarning(true);
  };

  const handleConfirmHireBroker = () => {
      if (pendingHireBrokerId) {
          handleAcceptBroker(pendingHireBrokerId);
      }
      setShowHireBrokerWarning(false);
      setPendingHireBrokerId(null);
  };

  const handleDeleteRequest = async () => {
      try {
          setIsDeleting(true);
          await wizardService.deleteRequest(id!);
          toast.success("Request Deleted", { description: "Your project request has been permanently deleted." });
          navigate(ROUTES.CLIENT_DASHBOARD);
      } catch (error: any) {
          const message = error?.response?.data?.message || "Failed to delete request";
          toast.error("Delete Failed", { description: message });
      } finally {
          setIsDeleting(false);
          setShowDeleteConfirm(false);
      }
  };

  const handleReleaseBrokerSlot = async (proposalId: string) => {
      if (!request) return;
      try {
          await wizardService.releaseBrokerSlot(request.id, proposalId);
          toast.success("Broker slot released.");
          void fetchData(request.id);
      } catch (error) {
          toast.error(getApiErrorDetails(error, "Failed to release broker slot.").message);
      }`
);

// conflict 4
content = content.replace(
/<<<<<<< HEAD\r?\n\s*<Card>\r?\n\s*<CardHeader>[\s\S]*?<\/Card>\r?\n=======\r?\n\s*<RequestBrokerMarketPanel[\s\S]*?formatDate=\{safeFormatDate\}\r?\n\s*\/>\r?\n>>>>>>> a13656348293bc67793a6e682dd221fbf8c1eb32/g,
`              <RequestBrokerMarketPanel
                request={request}
                currentPhase={currentPhase}
                isUpdatingStatus={isUpdatingStatus}
                brokerSlotSummary={brokerSlotSummary}
                pendingBrokerApplications={pendingBrokerApplications}
                nonPendingBrokerApplications={nonPendingBrokerApplications}
                matches={matches}
                brokerMatchesLoading={brokerMatchesLoading}
                onChangeVisibility={handleStatusChange}
                onAcceptBroker={handleHireBrokerClick}
                onReleaseBrokerSlot={handleReleaseBrokerSlot}
                onInviteBroker={handleInvite}
                onOpenProfile={handleOpenCandidateProfile}
                onPhaseAdvance={() => setActiveTab("phase2")}
                onOpenAssignedBrokerProfile={
                  assignedBrokerProfileId
                    ? () => navigate(\`/client/discovery/profile/\${assignedBrokerProfileId}\`)
                    : null
                }
                onOpenScoreExplanation={() => setIsScoreExplanationOpen(true)}
                onSearchMarketplace={() => navigate(\`/client/discovery?role=\${UserRole.BROKER}\`)}
                onGetAiSuggestions={() => id && fetchBrokerMatches(id, true)}
                formatDate={safeFormatDate}
              />`
);

fs.writeFileSync(file, content);
console.log('RequestDetailPage done');
