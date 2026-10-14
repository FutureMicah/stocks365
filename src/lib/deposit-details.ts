// Where customers send deposit money. Fill in YOUR real details below.
// Any field left as "" is hidden. If a method has no filled-in fields, customers see
// "details not available yet" instead of blank or fake information.
export type DepositField = { label: string; value: string };
export type DepositMethodDetails = { title: string; fields: DepositField[]; note: string };

export const depositDetails: Record<"ach" | "crypto", DepositMethodDetails> = {
  ach: {
    title: "Bank transfer (ACH) details",
    fields: [
      { label: "Bank name", value: "" },
      { label: "Account name", value: "" },
      { label: "Account number", value: "" },
      { label: "Routing number", value: "" },
    ],
    note: "Send the transfer from a bank account in your own name and include your reference in the memo. Then enter the amount below and click Deposit so an administrator can match and approve it.",
  },
  crypto: {
    title: "Crypto deposit details",
    fields: [
      { label: "Asset", value: "" },
      { label: "Network", value: "" },
      { label: "Wallet address", value: "" },
    ],
    note: "Send only the asset shown, on the network shown. Sending anything else, or using a different network, can mean the funds are lost permanently. After sending, enter the amount below and click Deposit so an administrator can match and approve it.",
  },
};
