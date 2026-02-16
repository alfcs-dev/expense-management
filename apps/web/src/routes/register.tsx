import { useEffect, useState } from "react";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { authClient } from "../utils/auth-client";
import { SignupWrapper } from "../components/layout/page";
import { Button } from "../components/ui/button";
import { SubmitHandler, useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeClosed, EyeIcon, LockIcon, MailIcon, UserIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { resolvePostAuthPath, toCallbackURL } from "../utils/auth-session";

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: (search: Record<string, unknown>) => {
    if (typeof search.redirect === "string") {
      return { redirect: search.redirect };
    }
    return {};
  },
  component: RegisterPage,
});

type Inputs = {
  name: string;
  email: string;
  password: string;
};

function RegisterPage({
  className,
  ...props
}: React.ComponentProps<"div"> & { registerUrl?: string }) {
  const { t } = useTranslation();
  const { redirect } = registerRoute.useSearch();
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsSubmitting(true);
    const { email, name, password } = data;
    const callbackURL = toCallbackURL(resolvePostAuthPath(redirect));
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL,
    });

    if (error) {
      alert(error.message ?? t("home.signUpFailed"));
      // setMessage(error.message ?? t("home.signUpFailed"));
      setIsSubmitting(false);
      return;
    }
  };
  // const navigate = useNavigate();
  // const { data: session, isPending, refetch } = authClient.useSession();
  // const [name, setName] = useState("");
  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  // const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      void navigate({ to: resolvePostAuthPath(redirect) });
    }
  }, [navigate, redirect, session?.user]);

  // const buttonText = useMemo(() => {
  //   if (isSubmitting) {
  //     return t("home.creatingAccount");
  //   }
  //   return t("home.createAccount");
  // }, [isSubmitting, t]);

  // const handleSubmit = async (event: FormEvent) => {
  //   event.preventDefault();
  //   setMessage(null);
  //   setIsSubmitting(true);

  //   const callbackURL = `${window.location.origin}/`;
  //   const { error } = await authClient.signUp.email({
  //     name,
  //     email,
  //     password,
  //     callbackURL,
  //   });

  //   if (error) {
  //     setMessage(error.message ?? t("home.signUpFailed"));
  //     setIsSubmitting(false);
  //     return;
  //   }

  //   await refetch();
  //   setIsSubmitting(false);
  //   setMessage(t("home.accountCreatedSuccess"));
  // };

  return (
    <SignupWrapper>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("home.createAccount")}</CardTitle>
            <CardDescription>{t("home.registerDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field data-invalid={errors.name ? true : undefined}>
                  <FieldLabel htmlFor="name">{t("home.name")}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      required
                      aria-invalid={errors.name ? true : undefined}
                      {...register("name")}
                    />
                    <InputGroupAddon>
                      <UserIcon />
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
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
                    {isSubmitting ? t("home.creatingAccount") : t("home.createAccount")}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    {t("home.signIn")}?{" "}
                    <Link to="/sign-in" search={redirect ? { redirect } : undefined}>
                      {t("home.login")}
                    </Link>
                  </p>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </SignupWrapper>
  );
}
