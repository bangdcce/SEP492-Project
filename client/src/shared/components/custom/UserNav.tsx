import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { LogOut, User, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, STORAGE_KEYS } from "@/constants";

export function UserNav() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    initials: string;
    role?: string;
  }>({
    name: "User",
    email: "",
    initials: "U",
  });

  useEffect(() => {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser({
          name: userData.fullName || "User",
          email: userData.email || "",
          initials: (userData.fullName || "U").charAt(0).toUpperCase(),
          role: userData.role,
        });
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
  }, []);

  const handleProfileClick = () => {
    // Navigate based on role or to a generic profile path
    if (user.role === "ADMIN") navigate(ROUTES.ADMIN_PROFILE);
    else if (user.role === "STAFF")
      navigate(ROUTES.ADMIN_PROFILE); // Staff shares admin profile view often or separate
    else navigate(ROUTES.CLIENT_PROFILE); // Fallback
  };

  const handleLogout = async () => {
    try {
      // Call backend logout to clear httpOnly cookies
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send cookies
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear user info from localStorage
    localStorage.removeItem(STORAGE_KEYS.USER);
    navigate(ROUTES.LOGIN);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-8 w-8 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
          <Avatar className="h-8 w-8 transition-opacity hover:opacity-90">
            <AvatarImage src="/avatars/01.png" alt={user.name} />
            <AvatarFallback className="bg-slate-900 text-white font-medium">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleProfileClick}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
