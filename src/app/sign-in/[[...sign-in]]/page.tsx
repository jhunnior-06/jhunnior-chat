import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <main className="auth-page"><SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/chat" /></main>;
}
