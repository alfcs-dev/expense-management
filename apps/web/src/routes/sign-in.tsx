import { useEffect, useState } from "react";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { authClient } from "../utils/auth-client";
import { SignupWrapper } from "../components/layout/page";
import { Button } from "../components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitHandler, useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeClosed, EyeIcon, LockIcon, MailIcon } from "lucide-react";
import { resolvePostAuthPath, toCallbackURL } from "../utils/auth-session";

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (search: Record<string, unknown>) => {
    if (typeof search.redirect === "string") {
      return { redirect: search.redirect };
    }
    return {};
  },
  component: SignInPage,
});

type Inputs = {
  email: string;
  password: string;
};

function SignInPage({
  className,
  ...props
}: React.ComponentProps<"div"> & { registerUrl?: string }) {
  const { redirect } = signInRoute.useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsSubmitting(true);
    const { email, password } = data;
    const callbackURL = toCallbackURL(resolvePostAuthPath(redirect));
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL,
    });

    if (error) {
      alert(error.message ?? t("home.signInFailed"));
      setIsSubmitting(false);
      return;
    }
  };

  useEffect(() => {
    if (session?.user) {
      void navigate({ to: resolvePostAuthPath(redirect) });
    }
  }, [navigate, redirect, session?.user]);

  return (
    <SignupWrapper>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("home.signIn")}</CardTitle>
            <CardDescription>{t("home.loginDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field data-invalid={errors.email ? true : undefined}>
                  <FieldLabel htmlFor="email">{t("home.email")}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="email"
                      type="text"
                      placeholder="mail@example.com"
                      required
                      aria-invalid={errors.email ? true : undefined}
                      {...register("email")}
                    />
                    <InputGroupAddon>
                      <MailIcon />
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field data-invalid={errors.password ? true : undefined}>
                  <FieldLabel htmlFor="password">{t("home.password")}</FieldLabel>
                  {/* @TODO Implement forgot password later
                  <Link
                    to="/"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    {t("home.forgotPassword")}
                  </Link> */}
                  <InputGroup>
                    <InputGroupInput
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      required
                      aria-invalid={errors.password ? true : undefined}
                      {...register("password")}
                    />
                    <InputGroupAddon>
                      <LockIcon />
                    </InputGroupAddon>
                    <InputGroupAddon align="inline-end">
                      {showPassword ? (
                        <EyeIcon
                          cursor="pointer"
                          onClick={() => setShowPassword(!showPassword)}
                        />
                      ) : (
                        <EyeClosed
                          cursor="pointer"
                          onClick={() => setShowPassword(!showPassword)}
                        />
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                    {isSubmitting ? t("home.signingIn") : t("home.signIn")}
                  </Button>
                  <FieldDescription className="text-center">
                    {t("home.dontHaveAccount")}{" "}
                    <Link to="/register" search={redirect ? { redirect } : undefined}>
                      {t("home.register")}
                    </Link>
                  </FieldDescription>
                </Field>
                {/* worth adding this back in later*/}
                {/* <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              <Field>
                <Button variant="outline" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  Login with Apple
                </Button>
                <Button variant="outline" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Login with Google
                </Button>
              </Field> */}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        {/* <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription> */}
      </div>
    </SignupWrapper>
  );
}
