import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { STORAGE_KEYS } from "@/constants";
import { Button, Spinner } from "@/shared/components/ui";
import { getStoredJson } from "@/shared/utils/storage";
import { getTrustProfile } from "../api";
import { TrustProfileSection } from "../sections/TrustProfileSection";
import { ProjectHistorySection } from "../sections/ProjectHistorySection";
import type { TrustProfileResponse } from "../types";

export function TrustProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const currentUser = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);

  const [data, setData] = useState<TrustProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadTrustProfile = async () => {
      if (!id) {
        setError("Missing profile id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await getTrustProfile(id);
        if (!isCancelled) {
          setData(response);
        }
      } catch (loadError: unknown) {
        if (isCancelled) {
          return;
        }

        const message =
          (loadError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to load trust profile.";
        setError(message);
        setData(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrustProfile();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div>
              <h1 className="text-lg font-semibold">Unable to load trust profile</h1>
              <p className="mt-1 text-sm">{error || "Unknown error."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <TrustProfileSection
        user={data.user}
        reviews={data.reviews || []}
        currentUserId={currentUser?.id}
      />

      <ProjectHistorySection items={data.projectHistory || []} />
    </div>
  );
}

export default TrustProfilePage;
