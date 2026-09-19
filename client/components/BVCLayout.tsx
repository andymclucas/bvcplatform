import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  LayoutDashboard,
  Users,
  Calendar,
  Music,
  FileText,
  Bell,
  MessageSquare,
  CreditCard,
  ShoppingBag,
  Image,
  Radio,
  BookOpen,
  UserCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Recordings", icon: <Home className="h-4 w-4" /> },
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/announcements", label: "Announcements", icon: <Bell className="h-4 w-4" /> },
  { href: "/calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { href: "/attendance", label: "Attendance", icon: <UserCheck className="h-4 w-4" /> },
  { href: "/library", label: "Library", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { href: "/messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
  { href: "/gallery", label: "Gallery", icon: <Image className="h-4 w-4" /> },
  { href: "/live-streams", label: "Live Streams", icon: <Radio className="h-4 w-4" /> },
  { href: "/events", label: "Events", icon: <Music className="h-4 w-4" /> },
  { href: "/passes", label: "Passes", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/shop", label: "Shop", icon: <ShoppingBag className="h-4 w-4" /> },
  { href: "/members", label: "Members", icon: <Users className="h-4 w-4" />, adminOnly: true },
  { href: "/admin", label: "Admin", icon: <Settings className="h-4 w-4" />, adminOnly: true },
];

export default function BVCLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          {/* Logo / org name */}
          <Link href="/" className="font-semibold text-foreground mr-2 shrink-0">
            BVC
          </Link>

          {/* Desktop nav links (scrollable) */}
          <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1">
            {visibleItems.slice(0, 8).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  location === item.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {visibleItems.length > 8 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {visibleItems.slice(8).map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                        {item.icon}
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            {/* User menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <span className="max-w-[120px] truncate">{user.firstName ?? user.email}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/attendance-history" className="flex items-center gap-2 cursor-pointer">
                      <History className="h-4 w-4" /> Attendance History
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="h-4 w-4" /> Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onSelect={() => logout()}
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <nav className="md:hidden border-t px-4 py-3 space-y-1 bg-background">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  location === item.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            {user && (
              <>
                <hr className="my-2" />
                <button
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            )}
          </nav>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
