import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { userService } from "../services/userService";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/apiClient";
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
    const { currentUser, loading: authLoading, login } = useAuth();
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

                login(res.data);
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

            try {
                const me = await apiFetch("/auth/me");
                if (me?.profile) {
                    login({
                        id: me.profile.id,
                        name: me.profile.name,
                        email: me.profile.email,
                        roleId: me.profile.role_id,
                        departmentId: me.profile.department_id || "",
                    });
                }
            } catch (_) {
                // ignore
            }

            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err?.message || "An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-hidden">
            {/* Left Panel: Branding & Info */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-primary items-center justify-center p-12 overflow-hidden shadow-2xl">
                {/* Background decorative elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-foreground/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-[80%] h-[80%] bg-primary-foreground/5 rounded-full blur-[150px]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/90" />

                    {/* Subtle grid pattern */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                </div>

                <div className="relative z-10 w-full max-w-lg text-primary-foreground">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary-foreground/10 backdrop-blur-md rounded-full border border-primary-foreground/20 mb-8 animate-in slide-in-from-bottom-4 duration-700">
                        <SparklesIcon className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">The Future of Work</span>
                    </div>

                    <h2 className="text-6xl font-black mb-6 leading-[1.1] tracking-tighter animate-in slide-in-from-bottom-8 duration-700 delay-100">
                        Process <br />
                        <span className="text-primary-foreground/60">Smarter.</span>
                    </h2>

                    <p className="text-xl text-primary-foreground/80 font-medium mb-12 max-w-md leading-relaxed animate-in slide-in-from-bottom-12 duration-700 delay-200">
                        DocuFlow-AI leverages advanced intelligence to automate your document workflows,
                        giving you more time to focus on what matters most.
                    </p>

                    <div className="grid grid-cols-2 gap-8 animate-in slide-in-from-bottom-16 duration-700 delay-300">
                        <div className="space-y-2">
                            <h4 className="text-3xl font-black">99%</h4>
                            <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60">Accuracy Rate</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-3xl font-black">10x</h4>
                            <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60">Faster Processing</p>
                        </div>
                    </div>
                </div>

                {/* Decorative footer */}
                <div className="absolute bottom-8 left-12 right-12 flex justify-between items-center z-10 opacity-40 text-primary-foreground">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">DocuFlow AI</span>
                    <div className="flex gap-4">
                        <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                        <div className="w-2 h-2 rounded-full bg-current/40" />
                        <div className="w-2 h-2 rounded-full bg-current/40" />
                    </div>
                </div>
            </div>

            {/* Right Panel: Auth Form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background relative z-10">
                {/* Mobile background decorative elements */}
                <div className="lg:hidden absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
                </div>

                <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
                    {/* Brand Logo for Mobile */}
                    <div className="lg:hidden flex justify-center mb-12">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-2xl shadow-primary/30">
                            <SparklesIcon className="w-8 h-8 text-primary-foreground" />
                        </div>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                        <h1 className="text-4xl font-black text-foreground mb-3 tracking-tighter">
                            {isLogin ? "Welcome Back" : "Get Started"}
                        </h1>
                        <p className="text-muted-foreground font-medium">
                            {isLogin
                                ? "Great to see you again! Please enter your details."
                                : "Create your account to experience the next level of document automation."}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                    Full Name
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <UserCircleIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        required={!isLogin}
                                        className="block w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-foreground placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        placeholder="Enter your name"
                                        value={formData.name}
                                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <EnvelopeIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="block w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-foreground placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                    Password
                                </label>
                                {isLogin && (
                                    <button type="button" className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest transition-colors">
                                        Forgot?
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <LockClosedIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="block w-full pl-11 pr-12 py-3 bg-muted/50 border border-border/50 rounded-2xl text-foreground placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                                >
                                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {successMessage && (
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold text-center animate-in fade-in slide-in-from-top-2">
                                {successMessage}
                            </div>
                        )}

                        {error && (
                            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold text-center animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {submitting ? (
                                <span className="w-6 h-6 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="uppercase tracking-[0.2em] text-xs">{isLogin ? "Sign In" : "Create Account"}</span>
                                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-10 border-t border-border/50 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                            {isLogin ? "New to DocuFlow?" : "Already have an account?"}
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="ml-2 font-black text-primary hover:text-primary/80 uppercase tracking-widest text-xs transition-colors"
                            >
                                {isLogin ? "Join Now" : "Log In"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
