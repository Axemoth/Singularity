import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="relative min-h-screen bg-bg-base text-text-primary transition-colors duration-300">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-border-default/10 dark:bg-border-default/5 blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-border-default/10 dark:bg-border-default/5 blur-[120px]" aria-hidden />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-base/80 backdrop-blur-md px-6 py-4 md:px-12">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-text-secondary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-md bg-accent-primary text-text-inverse">
              <img src="/logo.png" alt="Singularity Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-bold text-text-primary">Singularity</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <div className="rounded-2xl border border-border-default bg-bg-raised p-8 shadow-xl backdrop-blur-xl md:p-12">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mb-8 text-xs text-text-tertiary">
            Last Updated: June 16, 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-text-secondary">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Singularity, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not access or use our services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">2. Description of Service</h2>
              <p>
                Singularity is a productivity application that connects with your Google Account to provide a unified user interface for reading, writing, and organizing Gmail messages, as well as managing calendar events.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">3. Google Account Integration</h2>
              <p>
                To use Singularity, you must authorize the application to access your Google account via OAuth. You retain full control over your Google credentials and permissions. You may revoke access at any time through your Google Account security settings.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">4. AI Co-Pilot & User Responsibility</h2>
              <p>
                Singularity features an AI-powered assistant (AI Co-Pilot) that can draft messages, suggest schedule changes, and perform workspace actions on your behalf.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Review Required:</strong> You are solely responsible for reviewing and confirming all drafts, replies, and scheduled events before they are finalized or sent.
                </li>
                <li>
                  <strong>Accuracy:</strong> AI generations can sometimes be inaccurate or contextually incorrect. Singularity is not liable for any issues, misunderstandings, or business disruptions arising from unverified actions taken by the AI Co-Pilot.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">5. Prohibited Activities</h2>
              <p>
                You agree not to use Singularity to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Send spam, bulk marketing, unsolicited emails, or phishing campaigns.</li>
                <li>Violate any Google API developer policies or terms of service.</li>
                <li>Decompile, reverse-engineer, or attempt to extract source code from the application.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">6. Limitation of Liability</h2>
              <p>
                Singularity is provided "as is" and "as available" without any warranties of any kind. We do not guarantee uninterrupted or error-free operation. In no event shall Singularity or its developers be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">7. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any changes by updating the "Last Updated" date at the top of these Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">8. Contact Information</h2>
              <p>
                For questions about these Terms, please contact support at:
              </p>
              <p className="font-semibold text-text-primary">
                Email: dipti.gorasia@gmail.com
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-bg-raised px-6 py-6 md:px-12 text-center text-xs text-text-tertiary">
        © {new Date().getFullYear()} Singularity. All rights reserved.
      </footer>
    </div>
  );
}
