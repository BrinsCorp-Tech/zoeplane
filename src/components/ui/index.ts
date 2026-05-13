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

// FormField — accessible form field wrapper (Batch E)
export {
  FormField,
  FormLabel,
  FormControl,
  FormHelperText,
  FormErrorText,
  type FormFieldProps,
  type FormLabelProps,
  type FormControlProps,
  type FormHelperTextProps,
  type FormErrorTextProps,
} from "./FormField/FormField";

// Tooltip — supplementary text overlay (Batch E)
export {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
  type TooltipContentProps,
} from "./Tooltip/Tooltip";

// Dropdown — interactive menu overlay (Batch E)
export {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuLabelProps,
} from "./Dropdown/Dropdown";

// Modal — full-overlay dialog surface (Batch E)
export {
  ModalRoot,
  ModalTrigger,
  ModalScrim,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
  type ModalContentProps,
  type ModalVariant,
  type ModalSize,
} from "./Modal/Modal";

// Toast — transient notification surface (Batch E)
export { Toaster, toast, type ToastOptions } from "./Toast/Toast";

// ─── Batch F — Foundation tier P0 (Story 2.6) ────────────────────────────────

// Select — single-select value-picker (Batch F)
export {
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectIcon,
  SelectTrigger,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
  type SelectTriggerProps,
  type SelectContentProps,
  type SelectTriggerSize,
} from "./Select/Select";

// Checkbox — boolean-toggle with three-state support (Batch F)
export { Checkbox, type CheckboxProps } from "./Checkbox/Checkbox";

// Radio — mutually-exclusive selection group (Batch F)
export {
  RadioGroup,
  RadioGroupItem,
  RadioGroupIndicator,
  type RadioGroupProps,
  type RadioGroupItemProps,
} from "./Radio/Radio";

// Tabs — horizontal tab navigation surface (Batch F)
export {
  TabsRoot,
  TabsList,
  Tab,
  TabPanel,
  type TabsVariant,
  type TabsSize,
  type TabsListProps,
  type TabProps,
  type TabPanelProps,
} from "./Tabs/Tabs";

// ─── Batch G — Foundation tier P0 final (Story 2.6) ──────────────────────────

// Spinner — CSS-only indeterminate rotational loading indicator (Batch G)
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner/Spinner";

// Skeleton — theme-aware Category-C2 placeholder primitive (Batch G)
export { Skeleton, type SkeletonProps, type SkeletonVariant } from "./Skeleton/Skeleton";
