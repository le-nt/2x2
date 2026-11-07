import { AssetType } from "./types";

interface Asset {
    Name: string;
    Description: string | undefined;
    AssetTypeId: AssetType
}

interface AssetDelivery {
  locations: AssetLocation[];
}

interface AssetLocation {
  assetFormat: string;
  location: string;
}

enum AccountStatus {
  Ok = 0,
  Suppressed = 1,
  Deleted = 2,
  GdprDeleted = 3
}

export type { Asset, AssetDelivery }
export { AccountStatus }