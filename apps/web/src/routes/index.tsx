import { FormEvent, useMemo, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { authClient } from "../utils/auth-client";

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
    <div>
      <h1>{t("home.title")}</h1>
      <p>{t("home.phase")}</p>
      <p>{t("home.publicMessage")}</p>

      {isPending ? <p>{t("home.checkingSession")}</p> : null}
      {session ? (
        <p>
          {t("home.signedInAs")} <strong>{session.user.email}</strong>.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p>
            <button type="button" onClick={() => setMode("signin")}>
              {t("home.signIn")}
            </button>{" "}
            |{" "}
            <button type="button" onClick={() => setMode("signup")}>
              {t("home.signUp")}
            </button>
          </p>

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

          <button type="submit" disabled={isSubmitting}>
            {buttonText}
          </button>
        </form>
      )}

      {message ? <p>{message}</p> : null}
    </div>
  );
}
