import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from "react";
import { supabase } from "../services/supabase";
import { userService } from "../services/userService";
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

    const loadProfile = async (userId: string | null) => {
        // same user already loaded
        if (userId && userId === lastUserId.current && currentUser) {
            setLoading(false);
            return;
        }

        lastUserId.current = userId;

        if (!userId) {
            if (!mountedRef.current) return;
            setCurrentUser(null);
            setLoading(false);
            return;
        }

        try {
            const profile = await userService.getUserProfile(userId);
            if (!mountedRef.current) return;

            if (profile) setCurrentUser(profile);
            else setCurrentUser(null);
        } catch (err) {
            console.error("Error fetching user profile:", err);
            if (!mountedRef.current) return;
            setCurrentUser(null);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        // ✅ 1) INITIAL SESSION LOAD (fix refresh logout)
        (async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) console.error("getSession error:", error.message);

                const userId = data.session?.user?.id ?? null;
                await loadProfile(userId);
            } catch (e) {
                console.error("Initial session read failed:", e);
                setLoading(false);
            }
        })();

        // ✅ 2) LISTEN AUTH CHANGES
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                const userId = session?.user?.id ?? null;
                await loadProfile(userId);
            }
        );

        return () => {
            mountedRef.current = false;
            authListener.subscription.unsubscribe();
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
        await supabase.auth.signOut();
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
