import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useAuthStore } from "../store/authStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AuthScreen({ open, onClose }: Props) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const init = useAuthStore((s) => s.init);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error: err } = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        if (err) {
          setError(err.message ?? "Failed to send reset email");
          setLoading(false);
          return;
        }
        setSuccess("Check your email for a reset link.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (err) {
          setError(err.message ?? "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
        });
        if (err) {
          setError(err.message ?? "Sign in failed");
          setLoading(false);
          return;
        }
      }

      // Refresh auth state and close
      init();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.pathname,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "forgot" ? "Reset Password" : mode === "signin" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-lg"
          >
            &times;
          </button>
        </div>

        {mode !== "forgot" && (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-white cursor-pointer mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-400">or</span>
              </div>
            </div>
          </>
        )}

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {mode !== "forgot" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}

          {error && (
            <p className="text-red-600 text-xs">{error}</p>
          )}
          {success && (
            <p className="text-green-600 text-xs">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors border-none cursor-pointer disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "forgot"
              ? "Send Reset Link"
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
          {mode === "signin" && (
            <p>
              <button
                onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}
                className="text-blue-600 hover:underline bg-transparent border-none cursor-pointer text-xs"
              >
                Forgot password?
              </button>
            </p>
          )}
          <p>
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
                  className="text-blue-600 hover:underline bg-transparent border-none cursor-pointer text-xs"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Back to{" "}
                <button
                  onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
                  className="text-blue-600 hover:underline bg-transparent border-none cursor-pointer text-xs"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
