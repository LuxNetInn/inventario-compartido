import React, { createContext, useContext, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

type Currency = "USD" | "CUP";

interface CurrencyContextType {
  displayCurrency: Currency;
  setDisplayCurrency: (c: Currency) => void;
  exchangeRate: number;
  format: (amount: number, currency?: Currency) => string;
  convert: (amount: number, from: Currency, to: Currency) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  displayCurrency: "USD",
  setDisplayCurrency: () => {},
  exchangeRate: 240,
  format: (n) => `$${n.toFixed(2)}`,
  convert: (n) => n,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = useState(240);

  const { data: rateSetting } = trpc.settings.get.useQuery({ key: "exchangeRate" });

  useEffect(() => {
    if (rateSetting) {
      const rate = parseFloat(rateSetting);
      if (!isNaN(rate) && rate > 0) setExchangeRate(rate);
    }
  }, [rateSetting]);

  const convert = (amount: number, from: Currency, to: Currency): number => {
    if (from === to) return amount;
    if (from === "USD" && to === "CUP") return amount * exchangeRate;
    if (from === "CUP" && to === "USD") return amount / exchangeRate;
    return amount;
  };

  const format = (amount: number, currency: Currency = displayCurrency): string => {
    const converted = convert(amount, "USD", currency);
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(converted);
    }
    return new Intl.NumberFormat("es-CU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted) + " CUP";
  };

  return (
    <CurrencyContext.Provider
      value={{ displayCurrency, setDisplayCurrency, exchangeRate, format, convert }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
