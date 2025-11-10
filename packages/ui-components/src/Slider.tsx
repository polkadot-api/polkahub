import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "./utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  rangeOverlay,
  rangeTicks,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  rangeOverlay?: React.ReactNode;
  rangeTicks?: boolean;
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
        ? defaultValue
        : [min, max],
    [value, defaultValue, min, max]
  );

  const calculateTicks = (tickLen: number) => {
    /**
     * The first offset is challenging. We want the offset as a % of the [min,max]
     * range, but making sure the tick is aligned with the [0,max] range.
     */
    const maxTicks = Math.floor(100 / tickLen);
    const pMin = (min / max) * 100;
    const startingTick = Math.ceil(pMin / tickLen);
    const firstTickOffset =
      ((startingTick * tickLen - pMin) / (100 - pMin)) * 100;

    const tickAmount = maxTicks - startingTick + 1;
    if (Number.isNaN(tickAmount) || tickAmount <= 0)
      return {
        ticks: [],
        firstTickOffset: 0,
      };

    const ticks = new Array(tickAmount)
      .fill(0)
      .map((_, i) => tickLen * (startingTick + i));

    return { ticks, firstTickOffset };
  };

  const ticks10 = calculateTicks(10);
  const ticks25 = calculateTicks(25);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "@container/slider relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
      >
        {rangeOverlay}
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-accent-foreground absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {rangeTicks ? (
        <>
          <div
            className="absolute hidden @sm/slider:flex top-0 right-0 justify-between text-[0.6rem] text-muted-foreground -translate-y-full"
            style={{
              left: `${ticks10.firstTickOffset}%`,
            }}
          >
            {ticks10.ticks.map((v, i) => (
              <div key={i}>{v}%</div>
            ))}
          </div>
          <div
            className="absolute flex @sm/slider:hidden top-0 right-0 justify-between text-[0.6rem] text-muted-foreground -translate-y-full"
            style={{
              left: `${ticks25.firstTickOffset}%`,
            }}
          >
            {ticks25.ticks.map((v, i) => (
              <div key={i}>{v}%</div>
            ))}
          </div>
        </>
      ) : null}
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          aria-disabled={props.disabled}
          key={index}
          className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
