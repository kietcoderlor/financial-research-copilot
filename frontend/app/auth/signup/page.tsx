import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="app-grid-bg min-h-screen" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
