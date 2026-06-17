import LandingPage from "./_components/landing/landing-page";

// Always show the landing page at "/".
// Session is intentionally NOT checked here - authenticated users
// still land here first and can navigate to /inbox themselves.
export default function Home() {
  return <LandingPage />;
}
