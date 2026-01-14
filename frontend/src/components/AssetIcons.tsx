"use client";

import { Car, Bike, Smartphone, Laptop, HardHat } from "lucide-react";

export type AssetType = "VEHICLE" | "MOTORCYCLE" | "PHONE" | "LAPTOP" | "EQUIPMENT";

export function AssetIcons({ assets }: { assets: Array<{ type: string }> }) {
  const getIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "VEHICLE":
      case "CAR":
        return <Car className="h-4 w-4" />;
      case "MOTORCYCLE":
      case "BIKE":
        return <Bike className="h-4 w-4" />;
      case "PHONE":
      case "SMARTPHONE":
        return <Smartphone className="h-4 w-4" />;
      case "LAPTOP":
      case "COMPUTER":
        return <Laptop className="h-4 w-4" />;
      default:
        return <HardHat className="h-4 w-4" />;
    }
  };

  if (!assets || assets.length === 0) return <span className="text-zinc-300">-</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {assets.map((asset, idx) => (
        <div
          key={idx}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          title={asset.type}
        >
          {getIcon(asset.type)}
        </div>
      ))}
    </div>
  );
}

