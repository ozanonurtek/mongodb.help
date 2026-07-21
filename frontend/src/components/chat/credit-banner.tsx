import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircleAlert, TriangleAlert } from "lucide-react";

export function CreditBanner({
  freeBalance,
  dailyGrant,
  noneLabel,
  lowLabel,
  okLabel,
}: {
  freeBalance: number | null;
  dailyGrant: number;
  noneLabel: string;
  lowLabel: (remaining: number) => string;
  okLabel: (remaining: number) => string;
}) {
  if (freeBalance === null) return null;

  if (freeBalance <= 0) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <CircleAlert />
        <AlertTitle>{noneLabel}</AlertTitle>
      </Alert>
    );
  }

  const low = dailyGrant > 0 && freeBalance <= Math.max(1, Math.ceil(dailyGrant * 0.2));

  return (
    <Alert
      className={
        "rounded-none border-x-0 border-t-0 " +
        (low ? "text-warn" : "text-muted-foreground")
      }
    >
      {low ? <TriangleAlert className="text-warn" /> : <CircleAlert />}
      <AlertDescription className={low ? "text-warn" : ""}>
        {low ? lowLabel(freeBalance) : okLabel(freeBalance)}
      </AlertDescription>
    </Alert>
  );
}
