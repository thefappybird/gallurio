"use client";

import * as React from "react";
import PhoneInputPrimitive, {
  type Country,
  type Value as E164Number,
} from "react-phone-number-input";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import "react-phone-number-input/style.css";

type PhoneInputProps = Omit<
  React.ComponentProps<typeof PhoneInputPrimitive>,
  "onChange"
> & {
  onChange?: (value: E164Number | undefined) => void;
};

function PhoneInput({ className, onChange, ...props }: PhoneInputProps) {
  return (
    <PhoneInputPrimitive
      className={cn("flex", className)}
      defaultCountry={"PH" as Country}
      international
      withCountryCallingCode
      inputComponent={Input}
      onChange={(value) => onChange?.(value)}
      {...props}
    />
  );
}

export { PhoneInput, type E164Number };
