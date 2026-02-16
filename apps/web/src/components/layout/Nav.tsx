import { User } from "@expense-management/trpc";
import { Link, useNavigate } from "@tanstack/react-router";

import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { authClient } from "@/utils/auth-client";
import { authRouterContext } from "@/utils/auth-session";

export function Nav({ user }: { user?: User | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetch } = authClient.useSession();

  // const onChangeLanguage = async (nextLanguage: "en" | "es") => {
  //   if (i18n.language === nextLanguage) return;
  //   await i18n.changeLanguage(nextLanguage);
  // };

  const onSignOut = async () => {
    await authClient.signOut();
    authRouterContext.invalidateSession();
    await refetch();
    await navigate({ to: "/sign-in" });
  };

  return user ? (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <nav className="flex flex-wrap items-center gap-3 text-sm flex-1">
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/dashboard">{t("nav.dashboard")}</Link>
          <Link to="/accounts">{t("nav.accounts")}</Link>
          <Link to="/budgets">{t("nav.budgets")}</Link>
          <Link to="/categories">{t("nav.categories")}</Link>
          <Link to="/expenses">{t("nav.expenses")}</Link>
          <Link to="/recurring-expenses">{t("nav.recurringExpenses")}</Link>
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
                <AvatarFallback>{user.name}</AvatarFallback>
              </Avatar>
              {user.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
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
        {/* <div className="ml-auto flex items-center gap-2" title={t("language.label")}> */}
        {/* <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onChangeLanguage("en")}
            disabled={i18n.language.startsWith("en")}
          >
            {t("language.en")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            size="lg"
            onClick={() => void onChangeLanguage("es")}
            disabled={i18n.language.startsWith("es")}
          >
            {t("language.es")}
          </Button> */}
        {/* </div> */}
      </div>
    </header>
  ) : null;
}
