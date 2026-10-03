import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return <main className="auth-page"><SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/chat" /></main>;
}
