import {
  Popover as NextUIPopover,
  type PopoverProps as NextUIPopoverProps,
} from '@heroui/react'

import { cn } from '@/utils/tailwind'

interface PopoverProps extends NextUIPopoverProps {}

function Popover(props: PopoverProps) {
  return (
    <NextUIPopover
      {...props}
      className={cn(['bg-zinc-200 dark:bg-zinc-800', props?.className ?? ''])}
    />
  )
}

export default Popover
