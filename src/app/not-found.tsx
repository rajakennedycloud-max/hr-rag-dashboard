import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Page not found</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
