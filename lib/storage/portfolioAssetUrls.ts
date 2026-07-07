import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";

type PortfolioAssetRef = {
  url?: string | null;
  assetId?: string | null;
  logoUrl?: string | null;
  logoAssetId?: string | null;
};

export function portfolioHeaderLogoUrl(asset?: PortfolioAssetRef | null) {
  const fallback = (asset?.logoUrl ?? asset?.url ?? "").trim();
  const assetId = (asset?.logoAssetId ?? asset?.assetId ?? "").trim();
  if (!assetId) return fallback;
  return imageDeliveryUrl(assetId, {
    width: 512,
    height: 256,
    fit: "scale-down",
  }) || fallback;
}

export function portfolioSiteIconUrl(
  asset?: PortfolioAssetRef | null,
  fallbackUrl = "",
) {
  const fallback = asset?.url?.trim() ?? "";
  const assetId = asset?.assetId?.trim();
  if (!assetId) return fallback || fallbackUrl;
  return imageDeliveryUrl(assetId, {
    width: 512,
    height: 512,
    fit: "scale-down",
  }) || fallback || fallbackUrl;
}
