import type { FormEvent, Dispatch, SetStateAction } from "react";
import { Building2Icon, CreditCardIcon, InfoIcon, LandmarkIcon } from "lucide-react";
import { Button } from "@components/ui/Button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@components/ui/Field";
import { Input } from "@components/ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/InputGroup";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/Popover";

export type AccountType =
  | "debit"
  | "savings"
  | "investment"
  | "credit_card"
  | "credit"
  | "cash";
export type Currency = "MXN" | "USD";

export type FormState = {
  id: string | null;
  name: string;
  type: AccountType;
  currency: Currency;
  clabe: string;
  depositReference: string;
  beneficiaryName: string;
  bankName: string;
  institutionId: string;
  isProgrammable: boolean;
  cardNumberInput: string;
  cardBrand: string;
  cardLast4: string;
  statementDay: string;
  dueDay: string;
  graceDays: string;
};

export const emptyFormState: FormState = {
  id: null,
  name: "",
  type: "debit",
  currency: "MXN",
  clabe: "",
  depositReference: "",
  beneficiaryName: "",
  bankName: "",
  institutionId: "",
  isProgrammable: false,
  cardNumberInput: "",
  cardBrand: "",
  cardLast4: "",
  statementDay: "15",
  dueDay: "5",
  graceDays: "20",
};

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: "debit", label: "Debit" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "credit_card", label: "Credit card" },
];

type InstitutionOption = {
  id: string;
  name: string;
  bankCode: string | null;
};

type ClabeCheck = {
  isValid: boolean;
  bankCode: string | null;
  bankName: string | null;
};

type AccountFormProps = {
  formState: FormState;
  setFormState: Dispatch<SetStateAction<FormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onChangeCardNumber: (raw: string) => void;
  onCancel: () => void;
  formError: string | null;
  createErrorMessage: string | null;
  updateErrorMessage: string | null;
  isSaving: boolean;
  isCreditCardType: boolean;
  isCreditCycleType: boolean;
  clabeCheck: ClabeCheck;
  selectedInstitutionName: string | null;
  institutions: InstitutionOption[];
};

export function AccountForm({
  formState,
  setFormState,
  onSubmit,
  onChangeCardNumber,
  onCancel,
  formError,
  createErrorMessage,
  updateErrorMessage,
  isSaving,
  isCreditCardType,
  isCreditCycleType,
  clabeCheck,
  selectedInstitutionName,
  institutions,
}: AccountFormProps) {
  return (
    <form className="mt-4 grid gap-3 pb-4" onSubmit={(event) => void onSubmit(event)}>
      <FieldGroup className="gap-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account details
        </p>
        <Field>
          <FieldLabel htmlFor="account-name">
            Account name{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="account-name"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Main Debit, HSBC World Elite..."
              maxLength={100}
            />
            <InputGroupAddon>
              <Building2Icon />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="account-type">
              Type{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <select
              id="account-type"
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
              value={formState.type}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  type: event.target.value as AccountType,
                }))
              }
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="account-currency">
              Currency{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </FieldLabel>
            <select
              id="account-currency"
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
              value={formState.currency}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  currency: event.target.value as Currency,
                }))
              }
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>

        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Transfer profile
        </p>
        <Field>
          <FieldLabel htmlFor="account-clabe">CLABE</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="account-clabe"
              value={formState.clabe}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, clabe: event.target.value }))
              }
              placeholder="18 digits"
              maxLength={22}
            />
            <InputGroupAddon>
              <LandmarkIcon />
            </InputGroupAddon>
          </InputGroup>
          {formState.clabe ? (
            <FieldDescription
              className={clabeCheck.isValid ? "text-emerald-600" : "text-red-600"}
            >
              {clabeCheck.isValid
                ? `Valid CLABE${clabeCheck.bankCode ? ` · bank code ${clabeCheck.bankCode}` : ""}`
                : "Invalid CLABE"}
            </FieldDescription>
          ) : null}
          <FieldDescription>
            Institution:{" "}
            {selectedInstitutionName || clabeCheck.bankName || "Not selected"}
          </FieldDescription>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="deposit-reference">Deposit reference</FieldLabel>
            <Input
              id="deposit-reference"
              value={formState.depositReference}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  depositReference: event.target.value,
                }))
              }
              placeholder="Reference or alias"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="beneficiary-name">Beneficiary name</FieldLabel>
            <Input
              id="beneficiary-name"
              value={formState.beneficiaryName}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  beneficiaryName: event.target.value,
                }))
              }
              placeholder="Who receives the transfer"
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bank-name">Bank name</FieldLabel>
            <Input
              id="bank-name"
              value={formState.bankName}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  bankName: event.target.value,
                }))
              }
              placeholder="Manual bank name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="institution-code">Institution</FieldLabel>
            <select
              id="institution-code"
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
              value={formState.institutionId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  institutionId: event.target.value,
                }))
              }
            >
              <option value="">None</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name} ({institution.bankCode})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formState.isProgrammable}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                isProgrammable: event.target.checked,
              }))
            }
          />
          Programmable transfer profile
        </label>

        {isCreditCardType ? (
          <>
            <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Card details
            </p>
            <Field>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="card-number-input">Card number</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 rounded-full"
                    >
                      <InfoIcon className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 text-sm">
                    We never store the full card number. We only store brand and last 4
                    digits.
                  </PopoverContent>
                </Popover>
              </div>
              <InputGroup>
                <InputGroupInput
                  id="card-number-input"
                  value={formState.cardNumberInput}
                  onChange={(event) => onChangeCardNumber(event.target.value)}
                  placeholder="Card number"
                  maxLength={22}
                />
                <InputGroupAddon>
                  <CreditCardIcon />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {formState.cardBrand
                  ? `Detected brand: ${formState.cardBrand}`
                  : "Detected brand: pending"}
                {formState.cardLast4 ? ` · Stored last4: ${formState.cardLast4}` : ""}
              </FieldDescription>
              <FieldDescription>
                Institution: {selectedInstitutionName || "Not selected"}
              </FieldDescription>
            </Field>
            {isCreditCycleType ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="statement-day">Statement day</FieldLabel>
                  <Input
                    id="statement-day"
                    type="number"
                    min={1}
                    max={31}
                    value={formState.statementDay}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        statementDay: event.target.value,
                      }))
                    }
                    placeholder="15"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="due-day">Due day</FieldLabel>
                  <Input
                    id="due-day"
                    type="number"
                    min={1}
                    max={31}
                    value={formState.dueDay}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        dueDay: event.target.value,
                      }))
                    }
                    placeholder="5"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="grace-days">Grace days</FieldLabel>
                  <Input
                    id="grace-days"
                    type="number"
                    min={0}
                    max={90}
                    value={formState.graceDays}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        graceDays: event.target.value,
                      }))
                    }
                    placeholder="20"
                  />
                </Field>
              </div>
            ) : null}
          </>
        ) : null}
      </FieldGroup>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {createErrorMessage ? (
        <p className="text-sm text-red-600">{createErrorMessage}</p>
      ) : null}
      {updateErrorMessage ? (
        <p className="text-sm text-red-600">{updateErrorMessage}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : formState.id ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
