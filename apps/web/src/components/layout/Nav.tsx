import { User } from "@expense-management/trpc";
import { Link, useNavigate } from "@tanstack/react-router";

import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@components/ui/DropdownMenu";
import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@components/ui/Avatar";
import { authClient } from "@/utils/auth-client";
import { authRouterContext } from "@/utils/auth-session";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@components/ui/NavigationMenu";
import { cn } from "@/lib/utils";

export function Nav({ user }: { user?: User | null }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { refetch } = authClient.useSession();
  const displayName = user?.name?.trim() || user?.email || "User";
  const navLinks = [
    { to: "/dashboard", label: t("dashboard.title") },
    { to: "/accounts", label: "Accounts" },
    { to: "/categories", label: "Categories" },
    { to: "/budgets", label: "Budgets" },
    { to: "/bills", label: "Bills" },
    { to: "/transactions", label: "Transactions" },
  ] as const;

  const currentLanguage: "en" | "es" = i18n.resolvedLanguage?.startsWith("es")
    ? "es"
    : "en";

  const onChangeLanguage = async (nextLanguage: "en" | "es") => {
    if (currentLanguage === nextLanguage) return;
    await i18n.changeLanguage(nextLanguage);
  };

  const onSignOut = async () => {
    await authClient.signOut();
    authRouterContext.invalidateSession();
    await refetch();
    await navigate({ to: "/sign-in" });
  };

  return user ? (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-2 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto pb-1">
            <NavigationMenu viewport={false} className="w-max min-w-full justify-start">
              <NavigationMenuList className="flex-nowrap justify-start gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {navLinks.map(({ to, label }) => (
                  <NavigationMenuItem key={to}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={to}
                        activeOptions={{ exact: to === "/dashboard" }}
                        activeProps={{
                          className:
                            "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200",
                        }}
                        inactiveProps={{
                          className: "text-slate-600 hover:text-slate-900",
                        }}
                        className={cn(
                          "focus-visible:ring-ring/50 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-white/80 focus-visible:ring-[3px] focus-visible:outline-1",
                        )}
                      >
                        {label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                className="ml-auto max-w-[220px] shrink-0 gap-2 rounded-full pl-2"
              >
                <Avatar className="size-7">
                  <AvatarFallback>
                    <UserIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="hidden truncate text-left sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <UserIcon />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t("language.label")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={currentLanguage}
                    onValueChange={(value) =>
                      void onChangeLanguage(value === "es" ? "es" : "en")
                    }
                  >
                    <DropdownMenuRadioItem value="en">
                      {t("language.en")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="es">
                      {t("language.es")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onSignOut}
                style={{ cursor: "pointer" }}
              >
                <LogOutIcon />
                {t("session.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  ) : null;
}
