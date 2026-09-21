/** Compact inline loader for buttons, cards, and query states. */
import OnTheLineSpinner from "./OnTheLineSpinner";
import { cn } from "../../lib/utils";

type Props = {
  className?: string;
  label?: boolean | string;
};

export default function InlineLoader({ className, label = false }: Props) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <OnTheLineSpinner size="sm" label={label} />
    </div>
  );
}
