import { Suspense } from "react";
import MetaSetupContent from "./MetaSetupContent";

export default function MetaSetupPage() {
  return (
    <Suspense>
      <MetaSetupContent />
    </Suspense>
  );
}
