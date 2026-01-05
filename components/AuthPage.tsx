import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { userService } from "../services/userService";
import { useAuth } from "../contexts/AuthContext";
import {
    EnvelopeIcon,
    LockClosedIcon,
    UserCircleIcon,
    ArrowRightIcon,
    SparklesIcon,
    EyeIcon,
    EyeSlashIcon,
} from "./icons";

interface AuthPageProps {
    initialMode?: "login" | "signup";
}

// ✅ Local Result type guard (prevents TS narrowing issues)
type FailResult = { ok: false; message: string };
function isFail(res: any): res is FailResult {
    return res && res.ok === false && typeof res.message === "string";
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = "login" }) => {
    const { currentUser, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [isLogin, setIsLogin] = useState(initialMode === "login");
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });

    const from = useMemo(() => {
        return (location.state as any)?.from?.pathname || "/dashboard";
    }, [location.state]);

    useEffect(() => {
        setIsLogin(initialMode === "login");
    }, [initialMode]);

    useEffect(() => {
        if (!authLoading && currentUser) {
            navigate(from, { replace: true });
        }
    }, [authLoading, currentUser, from, navigate]);

    const toggleMode = () => {
        setIsLogin((v) => !v);
        setError(null);
        setSuccessMessage(null);
        setShowPassword(false);
        setFormData({ name: "", email: "", password: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        setError(null);
        setSuccessMessage(null);
        setSubmitting(true);

        try {
            const email = formData.email.trim();
            const password = formData.password;

            if (!email || !password) {
                setError("Email and password are required");
                return;
            }

            // -----------------------
            // ✅ LOGIN
            // -----------------------
            if (isLogin) {
                const res = await userService.signIn(email, password);

                if (isFail(res)) {
                    setError(res.message);
                    return;
                }

                navigate(from, { replace: true });
                return;
            }

            // -----------------------
            // ✅ SIGNUP
            // -----------------------
            const name = formData.name.trim();
            if (!name) {
                setError("Name is required for registration");
                return;
            }

            const res = await userService.signUp(name, email, password);

            if (isFail(res)) {
                setError(res.message);
                return;
            }

            const needsEmailConfirm = res?.data?.needsEmailConfirm === true;

            if (needsEmailConfirm) {
                setSuccessMessage(
                    res?.data?.message ||
                    "Registration successful! Please check your email to confirm."
                );
                setIsLogin(true);
                return;
            }

            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err?.message || "An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 mb-4 shadow-lg shadow-blue-900/20">
                        <SparklesIcon className="w-6 h-6 text-white" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        {isLogin ? "Welcome Back" : "Create Account"}
                    </h1>

                    <p className="text-gray-400 text-sm">
                        {isLogin
                            ? "Enter your credentials to access your workspace"
                            : "Join DocuFlow to start processing documents"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                                Full Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserCircleIcon className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    required={!isLogin}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, name: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <EnvelopeIcon className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                type="email"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, email: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockClosedIcon className="h-5 w-5 text-gray-500" />
                            </div>

                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="block w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData((p) => ({ ...p, password: e.target.value }))
                                }
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                ) : (
                                    <EyeIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {successMessage && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
                            {successMessage}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6"
                    >
                        {submitting ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                {isLogin ? "Sign In" : "Create Account"}
                                <ArrowRightIcon className="ml-2 -mr-1 h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-400">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            type="button"
                            onClick={toggleMode}
                            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {isLogin ? "Sign up" : "Log in"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};