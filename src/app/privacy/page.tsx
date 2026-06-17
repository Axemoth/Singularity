import Link from "next/link";

export default function PrivacyPolicyPage() {
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
        <div className="rounded-xl border border-border-default bg-bg-raised p-8 shadow-xl backdrop-blur-xl md:p-12">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mb-8 text-xs text-text-tertiary">
            Last Updated: June 16, 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-text-secondary">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">1. Introduction</h2>
              <p>
                Welcome to Singularity. We are committed to protecting your privacy. This Privacy Policy explains how Singularity collects, uses, and safeguards your information when you connect your Google account to our application to manage your Gmail and Google Calendar.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">2. Data Ownership and Processing</h2>
              <p>
                Singularity is a productivity tool designed to interact directly with your Google account. 
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Local Storage & Sync:</strong> We sync and cache your email threads, messages, drafts, and calendar events locally on your secured database instance to provide fast search and offline reading.
                </li>
                <li>
                  <strong>No Third-Party Access:</strong> We do not sell, trade, rent, or distribute your email content, calendar schedules, or contact lists to any third parties or external servers. All operations happen directly between your browser, your secured backend instance, and Google API servers.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">3. Google API Scopes and Usage</h2>
              <p>
                To provide our core features, Singularity requests access to your Google account using specific, limited OAuth scopes:
              </p>
              <div className="overflow-hidden rounded-xl border border-border-default bg-bg-base">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-default bg-bg-surface font-semibold text-text-primary">
                      <th className="p-3">Scope</th>
                      <th className="p-3">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default text-text-secondary">
                    <tr>
                      <td className="p-3 font-mono">gmail.modify</td>
                      <td className="p-3">Allows us to retrieve, read, archive, and delete emails in your inbox to provide a unified experience.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">gmail.compose</td>
                      <td className="p-3">Allows us to create and update draft emails when you draft messages or use our AI Co-Pilot.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">gmail.send</td>
                      <td className="p-3">Allows us to send emails on your behalf when you reply to a thread or write a new message.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">calendar</td>
                      <td className="p-3">Allows us to display your events, schedule new meetings, and edit existing events.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">4. Google API Limited Use Policy</h2>
              <p>
                Singularity's use and transfer of information received from Google APIs to any other app will adhere to the{" "}
                <a 
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-text-primary hover:text-accent-info"
                >
                  Google API Services User Data Policy
                </a>, including the **Limited Use** requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">5. Security of Your Data</h2>
              <p>
                We employ industry-standard encryption protocols (SSL/TLS) to secure all communications between your device, the backend, and Google API servers. User authentication tokens and keys are securely stored, encrypted, and isolated to ensure your personal communication hub remains completely secure.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">6. Contact Us</h2>
              <p>
                If you have any questions or feedback regarding this Privacy Policy, please contact us at:
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
