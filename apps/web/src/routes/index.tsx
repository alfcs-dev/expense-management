import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { authClient } from "../utils/auth-client";
import { PageShell, PageHeader, Section } from "../components/layout/page";
import { Button } from "../components/ui/button";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return mode === "signin" ? t("home.signingIn") : t("home.creatingAccount");
    }
    return mode === "signin" ? t("home.signIn") : t("home.createAccount");
  }, [isSubmitting, mode, t]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const callbackURL = `${window.location.origin}/dashboard`;

    if (mode === "signin") {
      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL,
      });

      if (error) {
        setMessage(error.message ?? t("home.signInFailed"));
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL,
      });

      if (error) {
        setMessage(error.message ?? t("home.signUpFailed"));
        setIsSubmitting(false);
        return;
      }
    }

    await refetch();
    setIsSubmitting(false);
    setMessage(
      mode === "signin" ? t("home.signedInSuccess") : t("home.accountCreatedSuccess")
    );
  };

  return (
    <PageShell>
      <PageHeader title={t("home.title")} description={t("home.publicMessage")} />
      <p className="muted">{t("home.phase")}</p>

      <Section>
      {isPending ? <p className="empty-text">{t("home.checkingSession")}</p> : null}
      {session ? (
        <p>
          {t("home.signedInAs")} <strong>{session.user.email}</strong>.
        </p>
      ) : (
        <form className="section-stack" onSubmit={handleSubmit}>
          <div className="inline-row">
            <Button type="button" variant={mode === "signin" ? "default" : "secondary"} onClick={() => setMode("signin")}>
              {t("home.signIn")}
            </Button>
            <Button type="button" variant={mode === "signup" ? "default" : "secondary"} onClick={() => setMode("signup")}>
              {t("home.signUp")}
            </Button>
          </div>

          {mode === "signup" ? (
            <p>
              <label>
                {t("home.name")}{" "}
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            </p>
          ) : null}

          <p>
            <label>
              {t("home.email")}{" "}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          </p>

          <p>
            <label>
              {t("home.password")}{" "}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
          </p>

          <Button type="submit" disabled={isSubmitting}>
            {buttonText}
          </Button>
        </form>
      )}

      {message ? <p className="muted">{message}</p> : null}
      </Section>
    </PageShell>
  );
}
