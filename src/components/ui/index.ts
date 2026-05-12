/**
 * ZoePlane UI component barrel export.
 *
 * Foundation tier components (Story 2.6 Batch D).
 * Import from here rather than from individual component paths.
 *
 * @example
 *   import { Button, Card, Icon } from "@/components/ui";
 */

// Icon — lucide-react typed wrapper
export { Icon, type IconProps, type IconSize } from "./Icon/Icon";

// Badge — inline-flex status indicator
export { Badge, badgeVariants, type BadgeProps } from "./Badge/Badge";

// Input — text input primitive with optional affixes
export { Input, type InputProps } from "./Input/Input";

// Card — layout container with optional interactive mode
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "./Card/Card";

// Button — primary interactive primitive
export { Button, buttonVariants, type ButtonProps } from "./Button/Button";
