"use client";

import { useParams } from "next/navigation";
import ProgressPoller from "@/components/ProgressPoller";

export default function ProcessingPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-2">Processing Your Content</h1>
      <p className="text-gray-500 mb-8">
        Extracting transcript and generating structured output...
      </p>
      <ProgressPoller jobId={jobId} />
    </div>
  );
}
