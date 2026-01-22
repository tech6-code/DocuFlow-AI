import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from "react";
import { userService } from "../services/userService";
import { apiFetch, clearSession, getAccessToken, setAuthFailureHandler } from "../services/apiClient";
import type { User } from "../types";

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    setCurrentUser: (user: User | null) => void;
    login: (user: User) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const lastUserId = useRef<string | null>(null);
    const mountedRef = useRef(true);

    const loadProfile = async () => {
        const token = getAccessToken();
        if (!token) {
            if (!mountedRef.current) return;
            setCurrentUser(null);
            setLoading(false);
            return;
        }

        try {
            const res = await apiFetch("/auth/me");
            if (!mountedRef.current) return;

            if (res?.profile) {
                const profile: User = {
                    id: res.profile.id,
                    name: res.profile.name,
                    email: res.profile.email,
                    roleId: res.profile.role_id,
                    departmentId: res.profile.department_id || "",
                };
                lastUserId.current = profile.id;
                setCurrentUser(profile);
            } else {
                setCurrentUser(null);
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            if (!mountedRef.current) return;
            clearSession();
            setCurrentUser(null);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        setAuthFailureHandler(() => {
            clearSession();
            userService.clearCache();
            lastUserId.current = null;
            setCurrentUser(null);
            setLoading(false);
        });
        (async () => {
            try {
                await loadProfile();
            } catch (e) {
                console.error("Initial session read failed:", e);
                setLoading(false);
            }
        })();

        return () => {
            mountedRef.current = false;
            setAuthFailureHandler(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = (user: User) => {
        lastUserId.current = user.id;
        setCurrentUser(user);
        setLoading(false);
    };

    const logout = async () => {
        setLoading(true);
        try {
            await apiFetch("/auth/logout", { method: "POST" });
        } catch (_) {
            // ignore
        }
        clearSession();
        userService.clearCache();
        lastUserId.current = null;
        setCurrentUser(null);
        setLoading(false);
    };

    return (
        <AuthContext.Provider
            value={{ currentUser, loading, setCurrentUser, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
